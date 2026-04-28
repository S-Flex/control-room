Here are the two field name lists, taken directly from the actual API responses.

---

## List Endpoint — `GET /automation/buckets-overview`

Returns an `Items` array. Each item has these fields:

| Field | Type | Description |
|---|---|---|
| `NestingBucketGUID` | string (UUID) | Unique identifier for the bucket — used in the detail URL |
| `NestingCandidateId` | string (UUID) | ID of the active nesting candidate |
| `NestQueue` | string | Queue name (e.g. `DE-1_FO_Magnetfoil05`) |
| `BucketName` | string | Media + laminate combination (e.g. `Magnetfoil05_127 - Geen laminaat`) |
| `MediaSizeWidth` | integer (mm) | Width of the media in millimetres |
| `MediaSizeHeight` | integer (mm) | Height/length of the media in millimetres |
| `Critetia` | array of strings | Nesting trigger conditions (e.g. `["Date/Time Due 4/29/2026 5:00:00 PM"]`) — note: typo in API |
| `NestingStatus` | string | Health flag: `"OK"` or `"Too large"` |
| `Status` | string | Lifecycle state: `"Active"` |
| `Process` | object | See sub-fields below |
| `Process.IsLocked` | boolean | Whether the queue is locked |
| `Process.ProcessName` | string | Current process state: `"Idle"` or `"Nesting"` |
| `Progress` | integer (%) | Fill percentage of the current nest |
| `IsDevicesAvailable` | boolean | Whether a printer device is available |
| `IsCuttingMarkDeleted` | boolean | Whether the cutting mark profile has been removed |
| `IsReferenceProfileDeleted` | boolean | Whether the reference profile has been removed |
| `IsRoll` | boolean | Whether the media is a roll (vs. sheet) |
| `NestingGroupId` | string (UUID) | Groups related queues together |
| `Documents` | null / array | Always `null` in the list endpoint |

---

## Detail Endpoint — `GET /automation/nest-info/{NestingBucketGUID}`

The detail page is rendered as HTML and shows two tables. The fields displayed are:

**Nest/Page summary table** (one row per nested page):

| Field | Description |
|---|---|
| Page | Page number within the nest |
| Copies | Number of copies on this page |
| % | Fill percentage of this page |
| `< Print deadline` | Nearest print deadline of the jobs on this page |
| `< PD%` | Percentage of jobs meeting the print deadline |
| `Length, m` | Length of the nested page in metres |

**Document detail table** (one row per placed job instance):

| Field | Description |
|---|---|
| `Document Name` | Full job filename (e.g. `1260255622P1_01-001_9394468_…_100pcs_16311053`) |
| `Page/nr` | Page number within the source document |
| `Size, mm` | Dimensions of the job in mm, formatted as `W X H` (e.g. `336 X 106`) |
| `Position, mm` | X/Y placement position on the nest sheet, formatted as `X X Y` (e.g. `25 X 16`) |
| `Print deadline` | Deadline timestamp for this specific job |

**Header info shown above the tables:**
- Nesting queue name
- Bucket name
- Count of nested jobs (e.g. `Nested (100)`)
- Count of too-large jobs (e.g. `Too large (0)`)
- Media description: type, roll name, width and height (e.g. `Roll | Roll_127x1900 | W: 1270mm x H: 19m`)

---

**Note on the detail endpoint:** The URL pattern is `/automation/nest-info/{NestingBucketGUID}?cid={NestingCandidateId}&page=1`. Both the `NestingBucketGUID` and `NestingCandidateId` come from the list endpoint. Is there a JSON response variant exists for the detail, since currently it only returns HTML.