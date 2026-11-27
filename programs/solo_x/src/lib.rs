use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

pub mod state;

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
