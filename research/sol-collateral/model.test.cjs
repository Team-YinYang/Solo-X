const {test}=require("node:test");
const assert=require("node:assert/strict");
const {value,canIssue,liquidatable,shortfall}=require("./model.cjs");
test("conservative valuation and freshness boundary",()=>{assert.equal(value(1000000000n,100000000n,2000000n,60n),98000000n);for(const age of [-1n,61n])assert.throws(()=>value(1n,100n,0n,age));assert.throws(()=>value(1n,100n,3n,0n));assert.throws(()=>value(1n,0n,0n,0n));});
test("issuance and liquidation boundaries",()=>{assert.equal(canIssue(180n,100n),true);assert.equal(canIssue(179n,100n),false);assert.equal(liquidatable(150n,100n),false);assert.equal(liquidatable(149n,100n),true);assert.equal(liquidatable(0n,0n),false);});
test("price gap and insurance requirement",()=>{assert.equal(shortfall(110n,100n),0n);assert.equal(shortfall(55n,100n),50n);assert.equal(shortfall(0n,100n),100n);});
test("rounding and large integer precision",()=>{assert.equal(value(1n,1n,0n,0n),0n);assert.equal(value(1000000000000000000n,100000000n,0n,0n),100000000000000000n);});
