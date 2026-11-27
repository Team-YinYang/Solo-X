//! Adversarial account-binding and reserve-invariant regression tests.
//! These Rust tests run in CI without a validator. Actual SPL-token authority
//! and transaction rollback behavior is exercised by tests/security.ts under
//! `anchor test` with the local validator configured in Anchor.toml.
use crate::state::{
    CurrencyState, AUTHORITY_SEED, CURRENCY_DECIMALS, CURRENCY_SEED, CURRENCY_STATE_VERSION,
    DEVNET_TEST_USDC_MINT, VAULT_SEED,
};
use anchor_lang::prelude::*;

fn currency_fixture(program_id: &Pubkey, issued_mint: Pubkey) -> (CurrencyState, Pubkey) {
    let (key, state_bump) =
        Pubkey::find_program_address(&[CURRENCY_SEED, issued_mint.as_ref()], program_id);
    let (vault, vault_bump) = Pubkey::find_program_address(&[VAULT_SEED, key.as_ref()], program_id);
    let (authority, authority_bump) =
        Pubkey::find_program_address(&[AUTHORITY_SEED, key.as_ref()], program_id);
    (
        CurrencyState {
            version: CURRENCY_STATE_VERSION,
            creator: Pubkey::new_unique(),
            issued_mint,
            collateral_mint: DEVNET_TEST_USDC_MINT,
            collateral_vault: vault,
            authority,
            state_bump,
            vault_bump,
            authority_bump,
        },
        key,
    )
}

#[test]
fn arbitrary_mints_have_independent_state_vault_and_authority_pdas() {
    let program_id = crate::id();
    let mut previous = Vec::new();
    for _ in 0..48 {
        let (state, key) = currency_fixture(&program_id, Pubkey::new_unique());
        state.validate_addresses(&program_id, &key).unwrap();
        assert_eq!(CURRENCY_DECIMALS, 6);
        assert!(!previous.contains(&key));
        assert!(!previous.contains(&state.collateral_vault));
        assert!(!previous.contains(&state.authority));
        previous.extend([key, state.collateral_vault, state.authority]);
    }
}

#[test]
fn cross_currency_vault_authority_and_mint_substitution_rejected() {
    let program = crate::id();
    let (first, key) = currency_fixture(&program, Pubkey::new_unique());
    let (second, _) = currency_fixture(&program, Pubkey::new_unique());

    let mut wrong = first.clone_for_security_test();
    wrong.collateral_vault = second.collateral_vault;
    assert!(wrong.validate_addresses(&program, &key).is_err());

    let mut wrong = first.clone_for_security_test();
    wrong.authority = second.authority;
    assert!(wrong.validate_addresses(&program, &key).is_err());

    let mut wrong = first.clone_for_security_test();
    wrong.issued_mint = second.issued_mint;
    assert!(wrong.validate_addresses(&program, &key).is_err());

    assert!(first
        .validate_addresses(&Pubkey::new_unique(), &key)
        .is_err());
    assert!(first
        .validate_addresses(&program, &Pubkey::new_unique())
        .is_err());
}

#[test]
fn all_bump_and_version_mutations_are_rejected() {
    let program = crate::id();
    let (currency, key) = currency_fixture(&program, Pubkey::new_unique());
    let mut wrong = currency.clone_for_security_test();
    wrong.state_bump ^= 1;
    assert!(wrong.validate_addresses(&program, &key).is_err());

    let mut wrong = currency.clone_for_security_test();
    wrong.vault_bump ^= 1;
    assert!(wrong.validate_addresses(&program, &key).is_err());

    let mut wrong = currency.clone_for_security_test();
    wrong.authority_bump ^= 1;
    assert!(wrong.validate_addresses(&program, &key).is_err());

    let mut wrong = currency.clone_for_security_test();
    wrong.version = 0;
    assert!(wrong.validate_addresses(&program, &key).is_err());
}

// Cloning the fixed-length state here avoids changing production account types.
trait SecurityFixtureClone {
    fn clone_for_security_test(&self) -> CurrencyState;
}

impl SecurityFixtureClone for CurrencyState {
    fn clone_for_security_test(&self) -> CurrencyState {
        CurrencyState {
            version: self.version,
            creator: self.creator,
            issued_mint: self.issued_mint,
            collateral_mint: self.collateral_mint,
            collateral_vault: self.collateral_vault,
            authority: self.authority,
            state_bump: self.state_bump,
            vault_bump: self.vault_bump,
            authority_bump: self.authority_bump,
        }
    }
}

/// Arithmetic-only oracle for one-to-one collateral transfers. This does NOT
/// replace validator tests of actual SPL-token ownership and CPI rollback.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Ledger {
    supply: u64,
    reserve: u64,
}

impl Ledger {
    fn solvent(self) -> bool {
        self.reserve >= self.supply
    }

    fn mint(&mut self, amount: u64) -> bool {
        if amount == 0 || !self.solvent() {
            return false;
        }
        if let (Some(supply), Some(reserve)) = (
            self.supply.checked_add(amount),
            self.reserve.checked_add(amount),
        ) {
            self.supply = supply;
            self.reserve = reserve;
            return true;
        }
        false
    }

    fn redeem(&mut self, amount: u64, holder_tokens: u64) -> bool {
        if amount == 0 || !self.solvent() || amount > holder_tokens {
            return false;
        }
        if let (Some(supply), Some(reserve)) = (
            self.supply.checked_sub(amount),
            self.reserve.checked_sub(amount),
        ) {
            self.supply = supply;
            self.reserve = reserve;
            return true;
        }
        false
    }

    fn convert(source: &mut Self, destination: &mut Self, amount: u64, holder_tokens: u64) -> bool {
        if amount == 0 || !source.solvent() || !destination.solvent() || amount > holder_tokens {
            return false;
        }
        if let (Some(src_supply), Some(src_reserve), Some(dst_supply), Some(dst_reserve)) = (
            source.supply.checked_sub(amount),
            source.reserve.checked_sub(amount),
            destination.supply.checked_add(amount),
            destination.reserve.checked_add(amount),
        ) {
            source.supply = src_supply;
            source.reserve = src_reserve;
            destination.supply = dst_supply;
            destination.reserve = dst_reserve;
            return true;
        }
        false
    }
}

#[test]
fn reserve_always_covers_supply_across_exhaustive_small_balance_transitions() {
    for supply in 0..=16 {
        for excess in 0..=4 {
            for amount in 0..=19 {
                let original = Ledger {
                    supply,
                    reserve: supply + excess,
                };
                let mut minted = original;
                if minted.mint(amount) {
                    assert!(minted.solvent());
                    assert_eq!(minted.reserve - minted.supply, excess);
                } else {
                    assert_eq!(minted, original);
                }
                let mut redeemed = original;
                if redeemed.redeem(amount, supply) {
                    assert!(redeemed.solvent());
                    assert_eq!(redeemed.reserve - redeemed.supply, excess);
                } else {
                    assert_eq!(redeemed, original);
                }
                let mut source = original;
                let mut destination = Ledger {
                    supply: 4,
                    reserve: 7,
                };
                let previous_destination = destination;
                if Ledger::convert(&mut source, &mut destination, amount, supply) {
                    assert!(source.solvent() && destination.solvent());
                    assert_eq!(source.reserve - source.supply, excess);
                    assert_eq!(destination.reserve - destination.supply, 3);
                    assert_eq!(source.reserve + destination.reserve, original.reserve + 7);
                } else {
                    assert_eq!(source, original);
                    assert_eq!(destination, previous_destination);
                }
            }
        }
    }
}

#[test]
fn failed_operations_and_overflows_leave_both_ledgers_unchanged() {
    for (source, destination, amount, holder) in [
        (
            Ledger {
                supply: 2,
                reserve: 1,
            },
            Ledger {
                supply: 4,
                reserve: 4,
            },
            1,
            1,
        ),
        (
            Ledger {
                supply: 3,
                reserve: 3,
            },
            Ledger {
                supply: 4,
                reserve: 3,
            },
            1,
            1,
        ),
        (
            Ledger {
                supply: 3,
                reserve: 3,
            },
            Ledger {
                supply: 4,
                reserve: 4,
            },
            4,
            4,
        ),
        (
            Ledger {
                supply: 3,
                reserve: 3,
            },
            Ledger {
                supply: 4,
                reserve: 4,
            },
            1,
            0,
        ),
        (
            Ledger {
                supply: 3,
                reserve: 3,
            },
            Ledger {
                supply: u64::MAX,
                reserve: u64::MAX,
            },
            1,
            1,
        ),
    ] {
        let mut a = source;
        let mut b = destination;
        assert!(!Ledger::convert(&mut a, &mut b, amount, holder));
        assert_eq!((a, b), (source, destination));
    }

    let mut ledger = Ledger {
        supply: u64::MAX,
        reserve: u64::MAX,
    };
    let original = ledger;
    assert!(!ledger.mint(1));
    assert_eq!(ledger, original);
    assert!(!ledger.redeem(1, 0));
    assert_eq!(ledger, original);
}

/// Deterministic xorshift generator: no new dependency or platform entropy.
fn next_random(state: &mut u64) -> u64 {
    *state ^= *state << 13;
    *state ^= *state >> 7;
    *state ^= *state << 17;
    *state
}

#[test]
fn seeded_accounting_sequences_preserve_invariants() {
    for seed in [1_u64, 22, 33, 0xdead_beef, u64::MAX] {
        let mut random = seed;
        let mut ledgers = [Ledger {
            supply: 0,
            reserve: 0,
        }; 3];
        let mut wallet = 10_000_u64;
        let mut successes = [0; 4];
        let mut failures = [0; 4];
        for step in 0..4096 {
            let op = (next_random(&mut random) % 4) as usize;
            let index = (next_random(&mut random) % 3) as usize;
            let other = (index + 1) % 3;
            let amount = match next_random(&mut random) % 8 {
                0 => 0,
                1 => u64::MAX,
                _ => next_random(&mut random) % 101 + 1,
            };
            let before = ledgers;
            let wallet_before = wallet;
            let a = before[index];
            let b = before[other];
            let mut expected = before;
            let mut expected_wallet = wallet;
            // Independent bounded oracle for the bounded wallet model.
            let valid = amount > 0
                && match op {
                    0 | 2 => amount <= wallet,
                    1 | 3 => amount <= a.supply,
                    _ => unreachable!(),
                };
            if valid {
                match op {
                    0 => {
                        expected[index].supply += amount;
                        expected[index].reserve += amount;
                        expected_wallet -= amount;
                    }
                    1 => {
                        expected[index].supply -= amount;
                        expected[index].reserve -= amount;
                        expected_wallet += amount;
                    }
                    2 => {
                        expected[index].reserve += amount;
                        expected_wallet -= amount;
                    }
                    3 => {
                        expected[index].supply -= amount;
                        expected[index].reserve -= amount;
                        expected[other].supply += amount;
                        expected[other].reserve += amount;
                    }
                    _ => unreachable!(),
                }
            }
            let accepted = match op {
                0 if amount <= wallet => {
                    let ok = crate::check_mint(amount, a.supply, a.reserve).is_ok();
                    if ok {
                        ledgers[index].supply += amount;
                        ledgers[index].reserve += amount;
                        wallet -= amount;
                    }
                    ok
                }
                1 => {
                    let ok =
                        crate::check_redemption(amount, a.supply, a.supply, a.reserve).is_ok();
                    if ok {
                        ledgers[index].supply -= amount;
                        ledgers[index].reserve -= amount;
                        wallet += amount;
                    }
                    ok
                }
                2 if amount > 0 && amount <= wallet => {
                    ledgers[index].reserve += amount;
                    wallet -= amount;
                    true
                }
                3 => {
                    let ok = crate::conversion::check_amounts(
                        amount,
                        a.supply,
                        a.reserve,
                        b.supply,
                        b.reserve,
                        a.supply,
                    )
                    .is_ok();
                    if ok {
                        ledgers[index].supply -= amount;
                        ledgers[index].reserve -= amount;
                        ledgers[other].supply += amount;
                        ledgers[other].reserve += amount;
                    }
                    ok
                }
                _ => false,
            };
            assert_eq!(accepted, valid, "seed={seed} step={step} op={op}");
            assert_eq!(ledgers, expected, "seed={seed} step={step}");
            assert_eq!(wallet, expected_wallet, "seed={seed} step={step}");
            assert!(ledgers.iter().all(|ledger| ledger.solvent()));
            assert_eq!(
                u128::from(wallet)
                    + ledgers.iter().map(|l| u128::from(l.reserve)).sum::<u128>(),
                10_000
            );
            if accepted {
                successes[op] += 1;
            } else {
                failures[op] += 1;
                assert_eq!(ledgers, before);
                assert_eq!(wallet, wallet_before);
            }
        }
        assert!(successes.iter().all(|&count| count > 0), "seed={seed}");
        assert!(failures.iter().all(|&count| count > 0), "seed={seed}");
    }
}
