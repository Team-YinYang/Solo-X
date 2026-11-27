use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

pub mod conversion;
#[cfg(test)]
mod security_tests;
pub mod state;

pub use conversion::*;

use state::{
    is_supported_collateral_mint, CurrencyError, CurrencyState, AUTHORITY_SEED, CURRENCY_DECIMALS,
    CURRENCY_SEED, VAULT_SEED,
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

/// Solo-X on-chain program.
///
#[program]
pub mod solo_x {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    pub fn convert_currency(ctx: Context<ConvertCurrency>, amount: u64) -> Result<()> {
        conversion::execute(ctx, amount)
    }

    /// Creates one zero-supply, six-decimal currency and its isolated collateral
    /// vault. The creator is recorded for attribution only: both token accounts
    /// are controlled by the per-currency authority PDA.
    pub fn create_currency(ctx: Context<CreateCurrency>) -> Result<()> {
        require!(
            is_supported_collateral_mint(&ctx.accounts.collateral_mint.key()),
            CurrencyError::UnsupportedCollateralMint
        );

        let currency = &mut ctx.accounts.currency;
        currency.version = state::CURRENCY_STATE_VERSION;
        currency.creator = ctx.accounts.creator.key();
        currency.issued_mint = ctx.accounts.issued_mint.key();
        currency.collateral_mint = ctx.accounts.collateral_mint.key();
        currency.collateral_vault = ctx.accounts.collateral_vault.key();
        currency.authority = ctx.accounts.authority.key();
        currency.state_bump = ctx.bumps.currency;
        currency.vault_bump = ctx.bumps.collateral_vault;
        currency.authority_bump = ctx.bumps.authority;

        currency.validate_addresses(ctx.program_id, &currency.key())
    }

    /// Deposits approved collateral and issues the same number of six-decimal
    /// base units. Both SPL CPIs execute atomically: a failed mint rolls back
    /// the collateral transfer.
    pub fn mint_currency(ctx: Context<MintCurrency>, amount: u64) -> Result<()> {
        let accounts = &ctx.accounts;
        accounts
            .currency
            .validate_addresses(ctx.program_id, &accounts.currency.key())?;
        check_mint(
            amount,
            accounts.issued_mint.supply,
            accounts.collateral_vault.amount,
        )?;

        token::transfer(
            CpiContext::new(
                accounts.token_program.to_account_info(),
                Transfer {
                    from: accounts.depositor_collateral_tokens.to_account_info(),
                    to: accounts.collateral_vault.to_account_info(),
                    authority: accounts.depositor.to_account_info(),
                },
            ),
            amount,
        )?;

        let currency_key = accounts.currency.key();
        let seeds: &[&[u8]] = &[
            AUTHORITY_SEED,
            currency_key.as_ref(),
            &[accounts.currency.authority_bump],
        ];
        token::mint_to(
            CpiContext::new_with_signer(
                accounts.token_program.to_account_info(),
                MintTo {
                    mint: accounts.issued_mint.to_account_info(),
                    to: accounts.recipient_issued_tokens.to_account_info(),
                    authority: accounts.authority.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )
    }

    /// Burns a holder's issued tokens and releases the same number of base
    /// units of configured collateral, in one atomic Solana transaction.
    ///
    /// The holder must sign and own both token accounts. Only the currency's
    /// authority PDA is permitted to transfer reserves from its isolated vault.
    pub fn redeem_currency(ctx: Context<RedeemCurrency>, amount: u64) -> Result<()> {
        ctx.accounts
            .currency
            .validate_addresses(ctx.program_id, &ctx.accounts.currency.key())?;

        check_redemption(
            amount,
            ctx.accounts.holder_issued_tokens.amount,
            ctx.accounts.issued_mint.supply,
            ctx.accounts.collateral_vault.amount,
        )?;

        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.issued_mint.to_account_info(),
                    from: ctx.accounts.holder_issued_tokens.to_account_info(),
                    authority: ctx.accounts.holder.to_account_info(),
                },
            ),
            amount,
        )?;

        let currency_key = ctx.accounts.currency.key();
        let seeds: &[&[u8]] = &[
            AUTHORITY_SEED,
            currency_key.as_ref(),
            &[ctx.accounts.currency.authority_bump],
        ];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.collateral_vault.to_account_info(),
                    to: ctx.accounts.holder_collateral_tokens.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
pub struct CreateCurrency<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        init,
        payer = creator,
        mint::decimals = CURRENCY_DECIMALS,
        mint::authority = authority,
    )]
    pub issued_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = creator,
        space = 8 + CurrencyState::INIT_SPACE,
        seeds = [CURRENCY_SEED, issued_mint.key().as_ref()],
        bump,
    )]
    pub currency: Account<'info, CurrencyState>,
    #[account(
        constraint = collateral_mint.decimals == CURRENCY_DECIMALS @ CurrencyError::InvalidDecimals,
        constraint = collateral_mint.key() != issued_mint.key() @ CurrencyError::InvalidMint,
    )]
    pub collateral_mint: Account<'info, Mint>,
    /// CHECK: This PDA is the mint authority and the owner of the vault; it does
    /// not need a data account and cannot be supplied as an external signer.
    #[account(seeds = [AUTHORITY_SEED, currency.key().as_ref()], bump)]
    pub authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = creator,
        token::mint = collateral_mint,
        token::authority = authority,
        seeds = [VAULT_SEED, currency.key().as_ref()],
        bump,
    )]
    pub collateral_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Accounts for an authorized collateral deposit and equal-value issuance.
#[derive(Accounts)]
pub struct MintCurrency<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        seeds = [CURRENCY_SEED, issued_mint.key().as_ref()],
        bump = currency.state_bump,
        has_one = issued_mint @ CurrencyError::InvalidMint,
        has_one = collateral_mint @ CurrencyError::InvalidCollateralMint,
        has_one = collateral_vault @ CurrencyError::InvalidVault,
        has_one = authority @ CurrencyError::InvalidAuthority,
    )]
    pub currency: Account<'info, CurrencyState>,
    #[account(
        mut,
        constraint = issued_mint.decimals == CURRENCY_DECIMALS @ CurrencyError::InvalidDecimals,
        constraint = issued_mint.mint_authority ==
            anchor_lang::solana_program::program_option::COption::Some(currency.authority)
            @ CurrencyError::InvalidAuthority,
        constraint = issued_mint.freeze_authority.is_none() @ CurrencyError::InvalidFreezeAuthority,
    )]
    pub issued_mint: Account<'info, Mint>,
    #[account(
        address = currency.collateral_mint @ CurrencyError::InvalidCollateralMint,
        constraint = collateral_mint.decimals == CURRENCY_DECIMALS @ CurrencyError::InvalidDecimals,
        constraint = collateral_mint.key() != issued_mint.key() @ CurrencyError::InvalidMint,
    )]
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = depositor_collateral_tokens.owner == depositor.key() @ CurrencyError::InvalidHolder,
        constraint = depositor_collateral_tokens.mint == collateral_mint.key() @ CurrencyError::InvalidCollateralMint,
    )]
    pub depositor_collateral_tokens: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = recipient_issued_tokens.mint == issued_mint.key() @ CurrencyError::InvalidMint,
    )]
    pub recipient_issued_tokens: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [VAULT_SEED, currency.key().as_ref()],
        bump = currency.vault_bump,
        constraint = collateral_vault.mint == collateral_mint.key() @ CurrencyError::InvalidCollateralMint,
        constraint = collateral_vault.owner == authority.key() @ CurrencyError::InvalidVaultAuthority,
        constraint = collateral_vault.delegate.is_none() @ CurrencyError::InvalidVaultDelegate,
        constraint = collateral_vault.close_authority.is_none() @ CurrencyError::InvalidVaultCloseAuthority,
    )]
    pub collateral_vault: Account<'info, TokenAccount>,
    /// CHECK: Canonical PDA verified by seeds and address constraint.
    #[account(
        seeds = [AUTHORITY_SEED, currency.key().as_ref()],
        bump = currency.authority_bump,
        address = currency.authority @ CurrencyError::InvalidAuthority,
    )]
    pub authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

/// Accounts for holder-authorized redemption of an existing currency.
/// All address relationships are checked before executing either SPL CPI.
#[derive(Accounts)]
pub struct RedeemCurrency<'info> {
    pub holder: Signer<'info>,
    #[account(
        seeds = [CURRENCY_SEED, issued_mint.key().as_ref()],
        bump = currency.state_bump,
        has_one = issued_mint @ CurrencyError::InvalidMint,
        has_one = collateral_mint @ CurrencyError::InvalidCollateralMint,
        has_one = collateral_vault @ CurrencyError::InvalidVault,
        has_one = authority @ CurrencyError::InvalidAuthority,
    )]
    pub currency: Account<'info, CurrencyState>,
    #[account(
        mut,
        constraint = issued_mint.decimals == CURRENCY_DECIMALS @ CurrencyError::InvalidDecimals,
        constraint = issued_mint.mint_authority ==
            anchor_lang::solana_program::program_option::COption::Some(currency.authority)
            @ CurrencyError::InvalidAuthority,
        constraint = issued_mint.freeze_authority.is_none() @ CurrencyError::InvalidFreezeAuthority,
    )]
    pub issued_mint: Account<'info, Mint>,
    #[account(
        address = currency.collateral_mint @ CurrencyError::InvalidCollateralMint,
        constraint = collateral_mint.decimals == CURRENCY_DECIMALS @ CurrencyError::InvalidDecimals,
        constraint = collateral_mint.key() != issued_mint.key() @ CurrencyError::InvalidMint,
    )]
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = holder_issued_tokens.owner == holder.key() @ CurrencyError::InvalidHolder,
        constraint = holder_issued_tokens.mint == issued_mint.key() @ CurrencyError::InvalidMint,
    )]
    pub holder_issued_tokens: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = holder_collateral_tokens.owner == holder.key() @ CurrencyError::InvalidHolder,
        constraint = holder_collateral_tokens.mint == collateral_mint.key() @ CurrencyError::InvalidCollateralMint,
    )]
    pub holder_collateral_tokens: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [VAULT_SEED, currency.key().as_ref()],
        bump = currency.vault_bump,
        constraint = collateral_vault.mint == collateral_mint.key() @ CurrencyError::InvalidCollateralMint,
        constraint = collateral_vault.owner == authority.key() @ CurrencyError::InvalidVaultAuthority,
        constraint = collateral_vault.delegate.is_none() @ CurrencyError::InvalidVaultDelegate,
        constraint = collateral_vault.close_authority.is_none() @ CurrencyError::InvalidVaultCloseAuthority,
    )]
    pub collateral_vault: Account<'info, TokenAccount>,
    /// CHECK: Canonical per-currency PDA; it owns the vault and signs only the
    /// checked collateral transfer using its validated program-derived seeds.
    #[account(
        seeds = [AUTHORITY_SEED, currency.key().as_ref()],
        bump = currency.authority_bump,
        address = currency.authority @ CurrencyError::InvalidAuthority,
    )]
    pub authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

/// Reject bad amounts and unbacked reserves *before* burning a holder's tokens.
/// Both CPIs are atomic: if the transfer fails after burning, runtime rollback
/// restores the burn and the collateral balances.
fn check_redemption(amount: u64, holder_balance: u64, supply: u64, reserves: u64) -> Result<()> {
    require!(amount > 0, CurrencyError::ZeroAmount);
    require!(
        holder_balance >= amount,
        CurrencyError::InsufficientHolderBalance
    );
    require!(supply >= amount, CurrencyError::InsufficientSupply);
    require!(reserves >= amount, CurrencyError::InsufficientReserves);
    // Never allow redemption on an already undercollateralized currency.
    require!(reserves >= supply, CurrencyError::UnderCollateralized);
    let remaining_supply = supply
        .checked_sub(amount)
        .ok_or(error!(CurrencyError::ArithmeticOverflow))?;
    let remaining_reserves = reserves
        .checked_sub(amount)
        .ok_or(error!(CurrencyError::ArithmeticOverflow))?;
    require!(
        remaining_reserves >= remaining_supply,
        CurrencyError::UnderCollateralized
    );
    Ok(())
}

/// Check the reserve invariant before either CPI. The SPL transfer also rejects
/// insufficient depositor balances, and transaction semantics roll it back if
/// the subsequent mint fails.
fn check_mint(amount: u64, supply: u64, reserves: u64) -> Result<()> {
    require!(amount > 0, CurrencyError::ZeroAmount);
    require!(reserves >= supply, CurrencyError::UnderCollateralized);
    supply
        .checked_add(amount)
        .ok_or(error!(CurrencyError::ArithmeticOverflow))?;
    reserves
        .checked_add(amount)
        .ok_or(error!(CurrencyError::ArithmeticOverflow))?;
    Ok(())
}

#[cfg(test)]
mod redemption_tests {
    use super::*;

    #[test]
    fn permits_any_funded_holder_without_creator_privilege() {
        assert!(check_redemption(25, 25, 100, 100).is_ok());
        assert!(check_redemption(25, 50, 100, 125).is_ok());
        assert!(check_redemption(1, 1, 1, 1).is_ok());
    }

    #[test]
    fn rejects_zero_and_insufficient_holder_balance() {
        assert!(check_redemption(0, 100, 100, 100).is_err());
        assert!(check_redemption(11, 10, 100, 100).is_err());
    }

    #[test]
    fn rejects_insufficient_supply_or_reserves() {
        assert!(check_redemption(11, 100, 10, 100).is_err());
        assert!(check_redemption(11, 100, 100, 10).is_err());
    }

    #[test]
    fn rejects_already_undercollateralized_reserves() {
        assert!(check_redemption(1, 10, 100, 99).is_err());
    }

    #[test]
    fn handles_maximum_units_without_overflow() {
        assert!(check_redemption(u64::MAX, u64::MAX, u64::MAX, u64::MAX).is_ok());
    }
}

#[cfg(test)]
mod mint_tests {
    use super::*;

    #[test]
    fn permits_equal_collateral_and_issuance() {
        assert!(check_mint(25, 100, 100).is_ok());
        assert!(check_mint(1, 0, 0).is_ok());
    }

    #[test]
    fn rejects_zero_or_unbacked_minting() {
        assert!(check_mint(0, 100, 100).is_err());
        assert!(check_mint(1, 100, 99).is_err());
    }

    #[test]
    fn rejects_overflow_before_token_cpis() {
        assert!(check_mint(1, u64::MAX, u64::MAX).is_err());
    }
}
