# Functional Documentation - Elena NCC / Sugar CRM Widget

## 1. Purpose

The Elena widget allows the NCC agent to handle a call, identify the contact in Sugar CRM, capture project information, and create the operational Sugar records required for case follow-up.

Usage URL:

```text
https://us-central1-voicebot-451222.cloudfunctions.net/nextiq-staging/widget/index-agent-token.html?campaign=elena&callId=${workitemInformation.workitemId}&agentToken=${window.thrio.sessionService.getHndlbarToken()}
```

## 2. Users

- NCC agent: uses the form during the call.
- Production team: installs the widget in Thrio/NCC and validates the operational flow.
- CRM/Sugar team: receives and manages Contacts, Tickets, and Needs Assessments created by the widget.

## 3. Functional Scope

The widget covers this flow:

1. Validates the agent session with the Thrio `agentToken` before showing the form.
2. Receives the `callId`/`workitemId` from Thrio.
3. Loads call details from the workitem API.
4. Searches for the contact in Sugar CRM using the phone number.
5. If the contact exists, pre-fills and locks the contact data.
6. If the contact does not exist, allows the agent to create a new contact.
7. Allows the agent to search for and select the company/account in Sugar.
8. Captures project and assessment information.
9. Creates the Sugar workflow: Contact when needed, Ticket, and Needs Assessment.
10. Stores the resulting IDs so NCC/production can consume them by `callId`.
11. Saves a per-call draft while the agent completes the form.

## 4. Expected Data From Thrio/NCC

The URL must send:

| Parameter | Required | Description |
| --- | --- | --- |
| `campaign=elena` | Yes | Identifies the widget configuration. |
| `callId` | Yes | Must match `workitemInformation.workitemId`. The widget also accepts `workitemid`, `workitemId`, and `callid`. |
| `agentToken` | Yes | Thrio session token obtained with `window.thrio.sessionService.getHndlbarToken()`. |

The integration can also send `postMessage` events or browser events to start/end calls, but for the proposed production setup the URL already provides the `callId`.

## 5. Main Screens and Fields

### Step 1 - Project Type, Company, and Contact

The agent selects the project type:

- Tube Tool
- Metal Finish
- Pipe Rattling

The agent also captures or validates:

- Company / Account
- Billing address
- PO / Job #
- Budget
- Budgetary quote
- Rental
- Preferred shipping method
- Credit terms
- Latest delivery date
- Still satisfied

The contact block shows:

- Name
- Title
- Marketing Title
- Lead Source
- Phone type
- Phone
- Email

If Sugar returns more than one contact, the agent can select the correct contact.

### Step 2 - Assessment

The assessment shown depends on the selected project type:

- Tube Tool: vessel, tube, tooling, and job detail assessment.
- Pipe Rattling: specific pipe rattling assessment.
- Metal Finish: currently shown as pending definition.

### Step 3 - Job Details

The agent completes additional job details and submits the form to Sugar.

## 6. Contact Behavior

When a call arrives:

1. The widget gets the phone number from the workitem API or from the URL/event.
2. It searches Sugar CRM in the `Contacts` module.
3. Configured lookup field: `phone_work`.
4. Phone variants are also considered, including cleaned digits and `+` prefixed format.

If no contact is found:

1. The widget enables the required fields to create one.
2. Contact creation requires:
   - Name
   - Account selected from search
   - Marketing Title
   - Lead Source
3. After creation, the contact ID is stored in the call state.

## 7. Expected Result in Sugar CRM

When the form is submitted, the backend creates or reuses:

| Record | Configured Sugar Module |
| --- | --- |
| Contact | `Contacts` |
| Ticket | `tic_Tickets` |
| Needs Assessment | `NA_NeedsAssessment` |

The widget attempts to relate:

- Ticket to Contact.
- Ticket to Needs Assessment.

If Sugar creates the records but a relationship fails, the widget displays an operational warning; the created IDs remain available.

## 8. Dynamic Field Behavior and Flow

### Initial Load

When the widget opens, the form is not shown until the `agentToken` is validated. If the token is valid, the agent enters the main step. In this initial state, only the first step is available; assessment and detail sections are enabled after `Project type` is selected.

### Project Type

The `Project type` field controls which steps and sections appear:

| Selection | What appears | What disappears or is disabled | Final button |
| --- | --- | --- | --- |
| No selection | Only the main step. | Hides Tube assessment, Metal Finish, Pipe Rattling, and Job details. | Not available. |
| `Tube Tool` | Shows `Tube assessment`, keeps `Job type` visible, and enables `Job details`. | Hides Metal Finish and Pipe Rattling. | Sugar submission is in step 3. |
| `Metal Finish` | Shows the `Metal finish` section. | Hides `Job type` and `Job details`. | `Push to Sugar CRM` appears in step 2. |
| `Pipe Rattling` | Shows the `Pipe rattling` section. | Hides `Job type` and `Job details`. | `Push to Sugar CRM` appears in step 2. |

Every time `Project type` changes, the widget returns to step 1, updates the assessment tab label, and disables fields in hidden sections so values outside the selected flow are not submitted.

### Job Type for Tube Tool

`Job type` only appears when `Project type = Tube Tool`. It is a multi-select field; each option activates an additional section in `Job details`:

| Checked option | Section that appears |
| --- | --- |
| `Clean` | `Tube cleaning` |
| `Test` | `Tube testing` |
| `Plug` | `Tube plugging` |
| `Remove` | `Tube removal` |
| `Install` | `Tube installation` |

If the agent unchecks an option, the corresponding section is hidden. Other selected sections remain visible, so hybrid jobs are supported, for example `Clean + Test + Plug`.

### Tube Removal - Pulling Subtype

Inside `Tube removal`, the `Tube pulling` block has a `Sub-type selector`. Only the accessory block for the selected subtype is shown:

| Selected subtype | Visible accessories |
| --- | --- |
| `Collet Puller` | Collet Set, Draw Bar, Nose Piece, Counter Balance, Pump. |
| `Super Collet Puller` | Collet Set, Draw Bar, Nose Piece, Counter Balance, Pump, Tie Rod. |
| `Manual Tube Puller` | Spears Nose Piece, Stub Tugger option, Spears, Horseshoe Lock, Spear Adapter, Counter Balance, Pump. |
| `Cyclgrip` | Counter Balance, Pump. |
| `Stub Tugger` | Spears, Collet Set, Counter Balance, Nose Piece, Pump. |
| `Tube Tugger` | Spears, Collet Set, Counter Balance, Nose Piece, Pump. |

When the subtype changes, the widget hides the previous subtype accessories and shows only the new subtype accessories.

### Tube Installation - Handhole Seat Grinder

Inside `Tube installation`, the `Handhole seat grinder` field controls `Seat grinder width`:

| Selection | Behavior |
| --- | --- |
| `Yes` | Shows the `Seat grinder width` field. |
| `No` | Hides `Seat grinder width`. |

### Found Contact vs New Contact

Contact block behavior depends on the Sugar lookup result:

| Lookup result | Field behavior |
| --- | --- |
| Contact found | `Name`, `Title`, `Phone`, and `Email` are prefilled and read-only. `Marketing Title`, `Lead Source`, and `Phone type` are disabled. The `Create in Sugar` button is hidden. |
| Multiple contacts found | In addition to the above, `Select contact` appears so the agent can choose the correct contact. |
| Contact not found | The widget enables capture for a new contact and shows `Create in Sugar`. |

To create a new contact, the agent must complete `Name`, select an `Account` from search, `Marketing Title`, and `Lead Source`.

### Account / Company

The `Company` field supports Sugar Account search:

1. The agent types at least 2 characters.
2. The agent clicks `Search`.
3. If Sugar returns accounts, `Select Account` appears.
4. When an account is selected, `Company`, `Street`, `City`, `State`, `Country`, and `Zip` are populated.
5. If the agent manually edits `Company`, the selected `account_id` is cleared and the agent must search/select again before creating a contact.

### Navigation and Submission

The progress indicator is recalculated based on visible steps:

- Tube Tool uses three steps: main, assessment, and details.
- Metal Finish and Pipe Rattling use two steps: main and assessment/submission.
- If there is no `Project type`, only the main step is available.

The `Push to Sugar CRM` button appears in the final functional step of the selected flow. On submit, the widget builds the payload using visible fields, prefilled values, call data, and draft-restored fields.

### Draft and Restore

When `campaign` and `callId` exist, every form change is saved as a draft. If the agent closes and reopens the same `callId`, the widget restores values and the active tab. During restore, dynamic rules are applied again: `Project type`, `Job type`, and conditional sections are shown according to the recovered values.

## 9. IDs Available to Production

After a successful submission, the widget stores the following by `campaign + callId`:

- `contactId`
- `ticketId`
- `needsAssessmentId`

Production can read them with:

```http
GET https://us-central1-voicebot-451222.cloudfunctions.net/nextiq-staging/api/widget-state?campaign=elena&callId=<CALL_ID>&consume=1
Authorization: Bearer <WIDGET_STATE_READ_TOKEN>
```

With `consume=1`, the backend returns the IDs and deletes both the state and the draft for that call to prevent reprocessing.

Expected response:

```json
{
  "ok": true,
  "consumed": true,
  "campaign": "elena",
  "callId": "<CALL_ID>",
  "ids": {
    "contactId": "<SUGAR_CONTACT_ID>",
    "ticketId": "<SUGAR_TICKET_ID>",
    "needsAssessmentId": "<SUGAR_NEEDS_ASSESSMENT_ID>"
  },
  "updatedAt": 1770000000000
}
```

## 10. Visible Functional States and Errors

| State | Meaning | Recommended Action |
| --- | --- | --- |
| Validating agent session | The Thrio token is being validated. | Wait. |
| Missing agent token | The URL did not receive `agentToken`. | Review the URL template in Thrio. |
| Agent session inactive | Thrio rejected the token. | Verify the agent session. |
| Workitem lookup failed | The call could not be loaded. | Validate `callId` and server token permissions. |
| No contact found | Sugar did not find a contact by phone. | Create the contact from the widget. |
| Contact create failed | Sugar rejected contact creation. | Review required fields or Sugar connectivity. |
| Push failed | Sugar workflow creation failed. | Review Sugar configuration and backend logs. |
| Sugar workflow created | Ticket and Needs Assessment were created. | Continue normal operation. |

## 11. Functional Production Checklist

- The URL configured in Thrio includes `campaign=elena`.
- `callId` uses `${workitemInformation.workitemId}`.
- `agentToken` uses `${window.thrio.sessionService.getHndlbarToken()}`.
- The agent can open the widget with an active session.
- When a call arrives, the widget shows `Workitem loaded` or `Call active`.
- The call phone number is used for contact lookup.
- Account search returns results with at least 2 characters.
- A new contact can be created when one does not exist.
- A Ticket is created in `tic_Tickets`.
- A Needs Assessment is created in `NA_NeedsAssessment`.
- Production can read `/api/widget-state` with the Bearer token.
- When using `consume=1`, a second read returns 404 because the state has already been consumed.
