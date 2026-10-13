# Locat consolidation — security, quality and Remote reconciliation

Snapshot: 2026-10-13. Integration target: `release/locat-v1.0`.
This is an audit only: do not merge, delete, close PRs, or replace current implementations on the strength of file presence alone.

## Verified exact Git blob matches

| File | Compared with | Blob SHA | Decision |
| --- | --- | --- | --- |
| `api/sentinel/readBody.ts` | `fix/locat-link-security-review` | `dc9dbeeae98862e2ad056ee02e54428a3f152f87` | Already present |
| `api/sentinel/readBody.test.ts` | `fix/locat-link-security-review` | `d5b6d8d06ee4a43c76cc3c9a14104b3804d6c4f3` | Already present |
| `src/lib/cryptoIsolation.test.ts` | `chore/locat-2.0-quality` | `89ab1a18170a0e033028f29e09f2f2fe4b9b426b` | Already present |
| `docs/LOCAT_2_QUALITY_JOURNAL.md` | `chore/locat-2.0-quality` | `91b42828c2ff269c31acee913983622d1149f8cd` | Already present |
| `remote/session.py` | `feat/locat-remote-prototype` | `18bfec4a4834cdd2d124aee058fdef2b69409430` | Already present |
| `compose.yaml` | `chore/locat-2.0-quality` | `6d81c4840185ab5c678e83c7a7d8257eb1ad6337` | Already present |

## Divergent files requiring semantic review

| File | Release blob | Historical branch blob | Review |
| --- | --- | --- | --- |
| `.github/workflows/ci.yml` | `abf0dfadb7f544d98c500f30e5159326634cc36c` | security `81fabc7c6f1ddf1951ba8e32e21d2ae6f4a461d4`; quality `1d598a0e3e91362767b87b9f14c12da42df36492` | Compare jobs, triggers, guards; do not replace wholesale |
| `api/sentinel/webhook.ts` | `a61ede1011e9a0e19db1089831543244c8fe0afb` | `8d0745bbb86f935394491df8130bc0343877a5b2` | Both contain bounded-body read; inspect other differences |
| `compose.yaml` | `6d81c4840185ab5c678e83c7a7d8257eb1ad6337` | security `bea5ec21c9a06d52963be34099f82fda3cbc4eb3` | Check runtime and security settings |
| `src/pages/Link.tsx` | `c7c1df308422fd08c09ea4b67774b362feba651e` | `8b1761e40eaf3a5d0c63cb1fb0dd605ba37d695a` | Verify security features retained in newer UI |
| `remote/server.py` | `1374459881cfb148595ab17efdf6553b31807167` | `4981f8638e5819f7f5ed06f94d84d1920a21dd40` | Check consent, auth, platform support |
| `remote/README.md` | `8494e06a0f4a972389bd45d5bf2fe4c0248d45e7` | `8880f4079b21cf07f27b7dc4be853b73d8925cc3` | Preserve useful history |

## Safety gates

1. Maintain original branch references and `archive/2026-10-13/*` references; neither is immutable against force updates. For long-term recovery, export a verified offline Git bundle or immutable release artifact.
2. Compare actual code semantics, not merely commit counts or blob identity.
3. Do not interpret an existing file as proof of a working feature.
4. Run tests and cross-platform builds before declaring integration complete.
5. Leave all open PRs and branches untouched until consolidation approval.
