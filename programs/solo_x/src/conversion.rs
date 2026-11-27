use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, TransferChecked};

use crate::state::{is_supported_collateral_mint, CurrencyState, AUTHORITY_SEED, CURRENCY_DECIMALS};

#[derive(Accounts)]
pub struct ConvertCurrency<'info> {
    pub holder: Signer<'info>,
    pub source: Account<'info, CurrencyState>,
    pub destination: Account<'info, CurrencyState>,
    #[account(mut)]
    pub source_mint: Account<'info, Mint>,
    #[account(mut)]
    pub destination_mint: Account<'info, Mint>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(mut)]
    pub source_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub destination_vault: Account<'info, TokenAccount>,
    /// CHECK: Validated against the canonical source authority PDA before CPI.
    pub source_authority: UncheckedAccount<'info>,
    /// CHECK: Validated against the canonical destination authority PDA before CPI.
    pub destination_authority: UncheckedAccount<'info>,
    #[account(mut, token::mint = source_mint, token::authority = holder)]
    pub source_tokens: Account<'info, TokenAccount>,
    #[account(mut, token::mint = destination_mint, token::authority = holder)]
    pub destination_tokens: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

fn validate_side(
    program_id: &Pubkey,
    state: &Account<CurrencyState>,
    mint: &Account<Mint>,
    vault: &Account<TokenAccount>,
    authority: &UncheckedAccount,
    collateral: Pubkey,
) -> Result<()> {
    state.validate_addresses(program_id, &state.key())?;
    require_keys_eq!(state.issued_mint, mint.key(), ConversionError::InvalidBinding);
    require_keys_eq!(state.collateral_mint, collateral, ConversionError::Incompatible);
    require_keys_eq!(state.collateral_vault, vault.key(), ConversionError::InvalidBinding);
    require_keys_eq!(state.authority, authority.key(), ConversionError::InvalidBinding);
    require_keys_eq!(vault.mint, collateral, ConversionError::InvalidBinding);
    require_keys_eq!(vault.owner, authority.key(), ConversionError::InvalidBinding);
    require!(
        mint.decimals == CURRENCY_DECIMALS
            && mint.mint_authority == anchor_lang::solana_program::program_option::COption::Some(authority.key())
            && mint.freeze_authority.is_none()
            && vault.delegate.is_none()
            && vault.close_authority.is_none(),
        ConversionError::InvalidBinding
    );
    Ok(())
}

fn check_amounts(amount: u64, source_supply: u64, source_reserve: u64, destination_supply: u64, destination_reserve: u64, holder_balance: u64) -> Result<()> {
    require!(amount > 0, ConversionError::ZeroAmount);
    require!(source_reserve >= source_supply && destination_reserve >= destination_supply, ConversionError::Insolvent);
    require!(amount <= source_supply && amount <= holder_balance, ConversionError::InsufficientTokens);
    destination_supply.checked_add(amount).ok_or(ConversionError::Overflow)?;
    destination_reserve.checked_add(amount).ok_or(ConversionError::Overflow)?;
    Ok(())
}

pub fn execute(ctx: Context<ConvertCurrency>, amount: u64) -> Result<()> {
    let a = ctx.accounts;
    require_keys_neq!(a.source.key(), a.destination.key(), ConversionError::Identical);
    require_keys_neq!(a.source_mint.key(), a.destination_mint.key(), ConversionError::Identical);
    require_keys_neq!(a.source_vault.key(), a.destination_vault.key(), ConversionError::Identical);
    require!(is_supported_collateral_mint(&a.collateral_mint.key()) && a.collateral_mint.decimals == CURRENCY_DECIMALS, ConversionError::Incompatible);
    validate_side(ctx.program_id, &a.source, &a.source_mint, &a.source_vault, &a.source_authority, a.collateral_mint.key())?;
    validate_side(ctx.program_id, &a.destination, &a.destination_mint, &a.destination_vault, &a.destination_authority, a.collateral_mint.key())?;
    check_amounts(amount, a.source_mint.supply, a.source_vault.amount, a.destination_mint.supply, a.destination_vault.amount, a.source_tokens.amount)?;
    let source_key = a.source.key();
    let destination_key = a.destination.key();
    let source_bump = [a.source.authority_bump];
    let destination_bump = [a.destination.authority_bump];
    let source_seeds: &[&[u8]] = &[AUTHORITY_SEED, source_key.as_ref(), &source_bump];
    let destination_seeds: &[&[u8]] = &[AUTHORITY_SEED, destination_key.as_ref(), &destination_bump];

    token::burn(CpiContext::new(a.token_program.to_account_info(), Burn {
        mint: a.source_mint.to_account_info(),
        from: a.source_tokens.to_account_info(),
        authority: a.holder.to_account_info(),
    }), amount)?;
    token::transfer_checked(CpiContext::new_with_signer(a.token_program.to_account_info(), TransferChecked {
        from: a.source_vault.to_account_info(),
        mint: a.collateral_mint.to_account_info(),
        to: a.destination_vault.to_account_info(),
        authority: a.source_authority.to_account_info(),
    }, &[source_seeds]), amount, CURRENCY_DECIMALS)?;
    token::mint_to(CpiContext::new_with_signer(a.token_program.to_account_info(), MintTo {
        mint: a.destination_mint.to_account_info(),
        to: a.destination_tokens.to_account_info(),
        authority: a.destination_authority.to_account_info(),
    }, &[destination_seeds]), amount)?;

    a.source_mint.reload()?;
    a.destination_mint.reload()?;
    a.source_vault.reload()?;
    a.destination_vault.reload()?;
    require!(a.source_vault.amount >= a.source_mint.supply && a.destination_vault.amount >= a.destination_mint.supply, ConversionError::Insolvent);
    Ok(())
}

#[error_code(offset = 100)]
pub enum ConversionError {
    #[msg("Conversion amount must be positive")]
    ZeroAmount,
    #[msg("Source and destination must be distinct")]
    Identical,
    #[msg("Currencies must use the same supported collateral")]
    Incompatible,
    #[msg("Invalid currency account binding")]
    InvalidBinding,
    #[msg("Both currencies must remain solvent")]
    Insolvent,
    #[msg("Insufficient source tokens")]
    InsufficientTokens,
    #[msg("Conversion arithmetic overflow")]
    Overflow,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_fully_backed_conversion() {
        assert!(check_amounts(10, 100, 100, 50, 50, 10).is_ok());
    }

    #[test]
    fn rejects_zero_and_insufficient_balance() {
        assert!(check_amounts(0, 100, 100, 50, 50, 10).is_err());
        assert!(check_amounts(11, 100, 100, 50, 50, 10).is_err());
    }

    #[test]
    fn rejects_insolvent_reserves() {
        assert!(check_amounts(10, 100, 99, 50, 50, 10).is_err());
        assert!(check_amounts(10, 100, 100, 50, 49, 10).is_err());
    }

    #[test]
    fn rejects_overflow() {
        assert!(check_amounts(1, 1, 1, u64::MAX, u64::MAX, 1).is_err());
        assert!(check_amounts(1, 1, 1, 0, u64::MAX, 1).is_err());
    }
}
