# DocumentVault

**Internal Links**: [[ConfirmationModal]], [[documents]]

## Local State
- `file` (File|null): The selected file to upload.
- `title`, `category`, `expiryDate`, `familyMemberId`, `selectedAsset`: Form state strings for uploading.
- `uploadStatus` (string: 'idle'|'uploading'|'success') and `error` (string).
- `confirmState` (object): Tracks `{isOpen, id}` for the delete confirmation modal.
- Queries for `assignable-assets`, `family-members`, and `documents`, with `uploadMutation` (multipart FormData) and `deleteMutation`.

## Key Functions & UI Behavior
- `handleUpload`: Constructs a `FormData` object with all form fields and the selected file before triggering the `uploadMutation`.
- `expiringDocs` (`useMemo`): Detects and returns documents expiring within the next 30 days to render an urgent alert banner.
- Renders a secure upload form with metadata fields linking the file to family members or assets. Displays an interactive vault list with download and delete capabilities.
---
**Tags**: #frontend #component #DocumentVault
