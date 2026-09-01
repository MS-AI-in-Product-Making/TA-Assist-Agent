import type { EngineeringWorkspaceModel } from "../workspace-model.js";
import { UploadPanel } from "./UploadPanel.js";
import { WorksheetPicker } from "./WorksheetPicker.js";

export interface WorkspaceToolbarProps {
  readonly model: EngineeringWorkspaceModel;
  readonly loading: boolean;
  readonly onUpload: (file: File) => Promise<void>;
  readonly onSelectWorksheet: (worksheetName: string) => void;
  readonly onUndo?: () => void;
  readonly onReset?: () => void;
  readonly onSave?: () => void;
  readonly canUndo?: boolean;
  readonly canSave?: boolean;
}

export function WorkspaceToolbar({ model, loading, onUpload, onSelectWorksheet, onUndo, onReset, onSave, canUndo = false, canSave = false }: WorkspaceToolbarProps) {
  const workbookName = model.workbookName ?? "No workbook selected";

  return (
    <header className="workspace-toolbar">
      <div className="workspace-toolbar__brand">
        <strong>TA Assist</strong>
        <span className="workspace-toolbar__workbook-name" title={workbookName}>{workbookName}</span>
        <span className="read-only-badge">Read-only source</span>
      </div>
      <WorksheetPicker worksheets={model.worksheets} selectedWorksheetName={model.selectedWorksheetName} onSelect={onSelectWorksheet} />
      <div className="workspace-toolbar__actions">
        <UploadPanel disabled={loading} onUpload={onUpload} compact />
        <button type="button" className="icon-button" title="Undo" aria-label="Undo" disabled={!canUndo} onClick={onUndo}>↶</button>
        <button type="button" className="icon-button" title="Reset scenario" aria-label="Reset scenario" disabled={!canUndo} onClick={onReset}>↺</button>
        <button type="button" className="button" disabled={!canSave} onClick={onSave}>Save scenario</button>
        <button type="button" className="button" disabled>Export</button>
      </div>
    </header>
  );
}
