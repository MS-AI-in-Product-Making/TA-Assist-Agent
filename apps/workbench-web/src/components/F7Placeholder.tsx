export interface F7PlaceholderProps {
  readonly status: {
    readonly status: string;
    readonly lifecycle?: string;
  };
}

export function F7Placeholder({ status }: F7PlaceholderProps) {
  return (
    <section className="panel" aria-labelledby="f7-placeholder-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">F7</p>
          <h2 id="f7-placeholder-title">F7 正在开发</h2>
        </div>
      </div>
      <p className="support-text">当前状态: {status.status}{status.lifecycle === undefined ? "" : ` / ${status.lifecycle}`}</p>
      <p className="support-text">工作台保留 F7 位置和后续 handoff 边界，但当前版本不提供 measured import、preview 或结果录入控件。</p>
    </section>
  );
}