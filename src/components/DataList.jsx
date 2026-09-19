import '../styles/list.css';

/**
 * Renders the `.list` / `.list_item` markup shared by the original
 * extra.js and links.js pages. `renderContent` lets each page decide what
 * goes in `.list_content` (plain text for Extra, a link for Links).
 */
export default function DataList({ items, renderContent }) {
  return (
    <div className="list" id="list">
      {items.map((item) => (
        <div className="list_item" key={item.id}>
          <p className="list_title">{item.title}</p>
          <div className="list_content">{renderContent(item)}</div>
          <div className="list_extra">{item.extra}</div>
        </div>
      ))}
    </div>
  );
}
