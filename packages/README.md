# Preserved Media Hub engines

Imported from feat/locat-media-hub @ 62cd389 as additive reference/library code.
These Python engines are **not mounted into the Hono server**, are not a second
shipping application, and their mock adapters must never authorize production
requests. Existing authenticated Node media endpoints remain canonical.

Native audio, parametric EQ, series metadata, subtitle engines and Python host
integration are still pending porting/runtime acceptance. Preserving source
prevents branch loss; it does not make these capabilities operational.
