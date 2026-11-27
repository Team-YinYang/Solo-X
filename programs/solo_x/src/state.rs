//! SOLO-X currency state and account constraints (issue #4).
//! This module declares accounts and validation helpers only. It does not
//! implement instructions that move or mint tokens.

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

pub const CURRENCY_STATE_VERSION: u8 = 1;
pub const CURRENCY_DECIMALS: u8 = 6;
pub const CURRENCY_SEED: &[u8] = b"currency";
pub const VAULT_SEED: &[u8] = b"vault";
pub const AUTHORITY_SEED: &[u8] = b"authority";

/// Official test-USDC mint on Solana devnet. Local validators clone this account
/// for integration testing; production collateral configuration is out of scope.
pub const DEVNET_TEST_USDC_MINT: Pubkey =
    anchor_lang::solana_program::pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

pub fn is_supported_collateral_mint(mint: &Pubkey) -> bool {
    *mint == DEVNET_TEST_USDC_MINT
}

/// PDA: ["currency", issued_mint]. No issuer-supplied authority.
#[account]
#[derive(InitSpace)]
pub struct CurrencyState {
    pub version: u8,
    /// Informational issuer identity; cannot mint or withdraw.
    pub creator: Pubkey,
    /// Six-decimal SPL Token currency mint.
    pub issued_mint: Pubkey,
    /// Configured six-decimal collateral mint (test USDC for MVP).
    pub collateral_mint: Pubkey,
    /// Isolated PDA token account: ["vault", currency_state].
    pub collateral_vault: Pubkey,
    /// Per-currency mint/vault authority: ["authority", currency_state].
    pub authority: Pubkey,
    pub state_bump: u8,
    pub vault_bump: u8,
    pub authority_bump: u8,
}

impl CurrencyState {
    pub fn validate_addresses(&self, program_id: &Pubkey, state_key: &Pubkey) -> Result<()> {
        require_eq!(
            self.version,
            CURRENCY_STATE_VERSION,
            CurrencyError::InvalidVersion
        );
        require_keys_neq!(
            self.issued_mint,
            self.collateral_mint,
            CurrencyError::InvalidMint
        );

        let (expected_state, state_bump) =
            Pubkey::find_program_address(&[CURRENCY_SEED, self.issued_mint.as_ref()], program_id);
        require_keys_eq!(*state_key, expected_state, CurrencyError::InvalidState);
        require_eq!(self.state_bump, state_bump, CurrencyError::InvalidBump);

        let (expected_vault, vault_bump) =
            Pubkey::find_program_address(&[VAULT_SEED, state_key.as_ref()], program_id);
        require_keys_eq!(
            self.collateral_vault,
            expected_vault,
            CurrencyError::InvalidVault
        );
        require_eq!(self.vault_bump, vault_bump, CurrencyError::InvalidBump);

        let (expected_authority, authority_bump) =
            Pubkey::find_program_address(&[AUTHORITY_SEED, state_key.as_ref()], program_id);
        require_keys_eq!(
            self.authority,
            expected_authority,
            CurrencyError::InvalidAuthority
        );
        require_eq!(
            self.authority_bump,
            authority_bump,
            CurrencyError::InvalidBump
        );
        Ok(())
    }
}

/// Shared account validation for later mint, redeem and conversion contexts.
/// Anchor's typed accounts enforce owning programs (standard SPL Token v1).
#[derive(Accounts)]
pub struct ValidateCurrency<'info> {
    #[account(
        seeds = [CURRENCY_SEED, issued_mint.key().as_ref()],
        bump = currency.state_bump,
        has_one = issued_mint @ CurrencyError::InvalidMint,
        has_one = collateral_mint @ CurrencyError::InvalidCollateralMint,
        has_one = collateral_vault @ CurrencyError::InvalidVault,
    )]
    pub currency: Account<'info, CurrencyState>,
    #[account(
        constraint = issued_mint.decimals == CURRENCY_DECIMALS @ CurrencyError::InvalidDecimals,
        constraint = issued_mint.mint_authority ==
            anchor_lang::solana_program::program_option::COption::Some(currency.authority)
            @ CurrencyError::InvalidAuthority,
        constraint = issued_mint.freeze_authority.is_none() @ CurrencyError::InvalidFreezeAuthority,
    )]
    pub issued_mint: Account<'info, Mint>,
    #[account(
        constraint = collateral_mint.decimals == CURRENCY_DECIMALS @ CurrencyError::InvalidDecimals,
        constraint = issued_mint.key() != collateral_mint.key() @ CurrencyError::InvalidMint,
    )]
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [VAULT_SEED, currency.key().as_ref()],
        bump = currency.vault_bump,
        constraint = collateral_vault.mint == currency.collateral_mint @ CurrencyError::InvalidCollateralMint,
        constraint = collateral_vault.owner == currency.authority @ CurrencyError::InvalidVaultAuthority,
        constraint = collateral_vault.delegate.is_none() @ CurrencyError::InvalidVaultDelegate,
        constraint = collateral_vault.close_authority.is_none() @ CurrencyError::InvalidVaultCloseAuthority,
    )]
    pub collateral_vault: Account<'info, TokenAccount>,
    /// CHECK: Address and signer PDA seeds are verified; never trust as an external signer.
    #[account(
        seeds = [AUTHORITY_SEED, currency.key().as_ref()],
        bump = currency.authority_bump,
        address = currency.authority @ CurrencyError::InvalidAuthority
    )]
    pub authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

impl<'info> ValidateCurrency<'info> {
    pub fn validate(&self, program_id: &Pubkey) -> Result<()> {
        self.currency
            .validate_addresses(program_id, &self.currency.key())
    }
}

#[error_code]
pub enum CurrencyError {
    #[msg("Unsupported currency state version")]
    InvalidVersion,
    #[msg("Currency state does not match issued mint")]
    InvalidState,
    #[msg("Invalid issued or collateral mint")]
    InvalidMint,
    #[msg("Collateral mint mismatch")]
    InvalidCollateralMint,
    #[msg("Collateral mint is not in the configured test-USDC allowlist")]
    UnsupportedCollateralMint,
    #[msg("Collateral vault mismatch")]
    InvalidVault,
    #[msg("Currency authority PDA mismatch")]
    InvalidAuthority,
    #[msg("Stored PDA bump mismatch")]
    InvalidBump,
    #[msg("Currency and collateral mint decimals must be six")]
    InvalidDecimals,
    #[msg("Issued mint freeze authority is not allowed")]
    InvalidFreezeAuthority,
    #[msg("Vault token owner is not the currency authority PDA")]
    InvalidVaultAuthority,
    #[msg("Vault token delegate is not allowed")]
    InvalidVaultDelegate,
    #[msg("Vault close authority is not allowed")]
    InvalidVaultCloseAuthority,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(program_id: Pubkey) -> (CurrencyState, Pubkey) {
        let mint = Pubkey::new_unique();
        let (state, state_bump) =
            Pubkey::find_program_address(&[CURRENCY_SEED, mint.as_ref()], &program_id);
        let (vault, vault_bump) =
            Pubkey::find_program_address(&[VAULT_SEED, state.as_ref()], &program_id);
        let (authority, authority_bump) =
            Pubkey::find_program_address(&[AUTHORITY_SEED, state.as_ref()], &program_id);
        (
            CurrencyState {
                version: CURRENCY_STATE_VERSION,
                creator: Pubkey::new_unique(),
                issued_mint: mint,
                collateral_mint: Pubkey::new_unique(),
                collateral_vault: vault,
                authority,
                state_bump,
                vault_bump,
                authority_bump,
            },
            state,
        )
    }

    #[test]
    fn accepts_valid_pdas() {
        let program = Pubkey::new_unique();
        let (currency, state) = fixture(program);
        assert!(currency.validate_addresses(&program, &state).is_ok());
    }

    #[test]
    fn rejects_cross_currency_vault() {
        let program = Pubkey::new_unique();
        let (mut first, state) = fixture(program);
        let (second, _) = fixture(program);
        first.collateral_vault = second.collateral_vault;
        assert!(first.validate_addresses(&program, &state).is_err());
    }

    #[test]
    fn rejects_substituted_issued_mint() {
        let program = Pubkey::new_unique();
        let (mut currency, state) = fixture(program);
        currency.issued_mint = Pubkey::new_unique();
        assert!(currency.validate_addresses(&program, &state).is_err());
    }

    #[test]
    fn rejects_wrong_program_id() {
        let program = Pubkey::new_unique();
        let (currency, state) = fixture(program);
        assert!(currency
            .validate_addresses(&Pubkey::new_unique(), &state)
            .is_err());
    }

    #[test]
    fn rejects_substituted_authority() {
        let program = Pubkey::new_unique();
        let (mut currency, state) = fixture(program);
        currency.authority = Pubkey::new_unique();
        assert!(currency.validate_addresses(&program, &state).is_err());
    }

    #[test]
    fn rejects_wrong_bump_and_version() {
        let program = Pubkey::new_unique();
        let (mut currency, state) = fixture(program);
        currency.vault_bump = currency.vault_bump.wrapping_add(1);
        assert!(currency.validate_addresses(&program, &state).is_err());
        let (mut currency, state) = fixture(program);
        currency.version = 2;
        assert!(currency.validate_addresses(&program, &state).is_err());
    }

    #[test]
    fn rejects_collateral_equal_to_issued_mint() {
        let program = Pubkey::new_unique();
        let (mut currency, state) = fixture(program);
        currency.collateral_mint = currency.issued_mint;
        assert!(currency.validate_addresses(&program, &state).is_err());
    }
}
