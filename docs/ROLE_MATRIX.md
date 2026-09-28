# Role and permission matrix

The product keeps the three existing roles. No treasurer, collector, or other role is introduced without owner approval.

| Capability | `super_admin` | `secretary` | `read_only` |
|---|---:|---:|---:|
| Platform overview, sectors, onboarding queue, audit log | Yes | No | No |
| Explicitly enter an active sector | Yes | N/A (fixed sector) | N/A (fixed sector) |
| Read sector finance data | Yes, in selected context | Yes, own sector | Yes, own sector |
| Create/update/delete finance records | Yes, selected context and audited | Yes, own sector | No |
| Manage secretary accounts | Any sector | No | No |
| Manage read-only accounts | Any sector | Own sector | No |
| Export sector reports | Selected context | Own sector | Own sector, read-only |
| Trigger Sheets backup | Platform/selected sector | Own sector where enabled | No |
| AI assistance | Selected context, subject to flags | Own sector, subject to flags | Read-only assistance only |
| Change own password/sign out | Yes | Yes | Yes |

## QA contract

Every protected route must be checked against this matrix. Tenant headers are ignored for secretary/read-only users when they conflict with their authenticated sector; super-admin finance operations require an explicit selected sector. New roles remain out of scope until separately approved.
