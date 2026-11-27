use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

/// Solo-X on-chain program.
///
/// The foundation instruction deliberately has no state transition. It proves that
/// the Anchor workspace, generated IDL and local-validator test path are wired up
/// before protocol accounts and issuance instructions are introduced.
#[program]
pub mod solo_x {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
