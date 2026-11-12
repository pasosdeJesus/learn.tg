export {}

declare global {
  namespace Chai {
    interface Assertion {
      reverted: Assertion
      revertedWith(reason: string): Assertion
      revertedWithCustomError(contract: unknown, errorName: string): Assertion
      emit(contract: unknown, event: string, ...args: unknown[]): Assertion
      withArgs(...args: unknown[]): Assertion
      changeEtherBalance(account: unknown, amount: unknown): Assertion
      changeEtherBalances(accounts: unknown[], amounts: unknown[]): Assertion
      changeTokenBalance(token: unknown, account: unknown, amount: unknown): Assertion
    }
  }
}
