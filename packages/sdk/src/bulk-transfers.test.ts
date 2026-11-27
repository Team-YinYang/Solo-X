import { test } from "node:test";
import assert from "node:assert/strict";
import { planBulkTransfers, executeBulkTransfers, type BulkTransport } from "./bulk-transfers.js";

const row = {id:"one", recipient:"11111111111111111111111111111111", amount:1n};
const persist = async () => {};
test("rejects oversized batches, duplicate IDs and zero amounts", () => {
  assert.throws(() => planBulkTransfers([]));
  assert.throws(() => planBulkTransfers(Array.from({length:21}, (_,i)=>({...row,id:String(i)}))));
  assert.throws(() => planBulkTransfers([row,row]));
  assert.throws(() => planBulkTransfers([{...row,amount:0n}]));
});
test("unknown broadcast is reconciled without signing again", async () => {
  const journal = planBulkTransfers([row]);
  let prepares = 0;
  const transport: BulkTransport = {
    async prepare() { prepares++; return {signature:"sig", async broadcast(){throw new Error("timeout");}}; },
    async status(){return "confirmed";}
  };
  await executeBulkTransfers(journal,transport,persist);
  assert.equal(journal[0].status,"unknown");
  await executeBulkTransfers(journal,transport,persist);
  await executeBulkTransfers(journal,transport,persist);
  assert.equal(journal[0].status,"confirmed");
  assert.equal(prepares,1);
});
test("partial failures remain visible and only failed rows retry", async () => {
  const journal = planBulkTransfers([row,{...row,id:"two"}]);
  let attempts = 0;
  const transport: BulkTransport = {
    async prepare(r) { attempts++; if(r.id==="two" && attempts===2) throw new Error("rejected"); return {signature:r.id,async broadcast(){}}; },
    async status(){return "confirmed";}
  };
  await executeBulkTransfers(journal,transport,persist);
  assert.deepEqual(journal.map(r=>r.status),["confirmed","failed"]);
  await executeBulkTransfers(journal,transport,persist);
  assert.deepEqual(journal.map(r=>r.status),["confirmed","confirmed"]);
  assert.equal(attempts,3);
});
