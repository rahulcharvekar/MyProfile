export default function Sidebar({ onMenuSelect, currentPage }) {
  const menu = [    
    { label: "About", key: "about" },
    { label: "Contact", key: "contact" },
    { label: "Dashboard", key: "dashboard" },
  ];

  return (
    <aside className="w-64 bg-gray-200 p-4">
      <ul className="space-y-2">
        {menu.map((item) => (
          <li
            key={item.key}
            className={`cursor-pointer ${currentPage === item.key ? "font-bold text-blue-600" : ""}`}
            onClick={() => onMenuSelect(item.key)}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </aside>
  );
}