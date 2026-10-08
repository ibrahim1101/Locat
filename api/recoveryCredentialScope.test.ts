import { describe, expect, it } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { activeRecoveryCredentialScope, revocableRecoveryCredentialScope } from "./recoveryCredentialScope";

const dialect = new MySqlDialect();
function compile(condition: ReturnType<typeof activeRecoveryCredentialScope>) {
  return dialect.sqlToQuery(sql`SELECT id FROM recovery_credentials WHERE ${condition}`);
}

describe("recovery credential ownership guards", () => {
  it("restricts inventory to active credentials owned by the signed-in user", () => {
    const query = compile(activeRecoveryCredentialScope(17));
    expect(query.sql).toContain("user_id");
    expect(query.sql).toContain("revoked_at");
    expect(query.sql).toContain("is null");
    expect(query.params).toEqual([17]);
  });

  it("requires both owner and credential ID when revoking", () => {
    const query = compile(revocableRecoveryCredentialScope(17, 42));
    expect(query.sql).toContain("user_id");
    expect(query.sql).toContain("revoked_at");
    expect(query.sql).toContain("id");
    expect(query.params).toEqual([17, 42]);
  });

  it("never reuses another account's owner ID", () => {
    const first = compile(revocableRecoveryCredentialScope(17, 42));
    const second = compile(revocableRecoveryCredentialScope(18, 42));
    expect(first.params).toEqual([17, 42]);
    expect(second.params).toEqual([18, 42]);
    expect(first.params).not.toEqual(second.params);
  });
});
