import type { ActionQueueItem } from "../workbench-session.js";

export interface ActionQueueProps {
  readonly items: readonly ActionQueueItem[];
}

export function ActionQueue({ items }: ActionQueueProps) {
  return (
    <section className="panel" aria-labelledby="queue-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Queue</p>
          <h2 id="queue-title">待执行动作</h2>
        </div>
      </div>
      {items.length === 0 ? <p className="support-text">当前没有待执行动作。</p> : null}
      <ul className="queue-list">
        {items.map((item, index) => (
          <li key={`${item.featureId}-${item.action}-${index}`} className="queue-item">
            <span>{item.featureId}</span>
            <span>{item.action}</span>
            <span>{item.blocking ? "blocking" : "non-blocking"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
