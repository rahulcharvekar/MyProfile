import myPic from '../assets/mypic.jpg';
export default function Sidebar({ onMenuSelect }) {

  const menu = [    
    { label: "About", key: "about" },
    { label: "Contact", key: "contact" },
    { label: "Dashboard", key: "dashboard" },
  ];

  return <div class="min-h-screen flex">
        
        <div class="bg-white w-64 border-r shadow-sm">
        
            <div class="py-4">
                
                <div class="px-4 mb-4">
                    <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Navigation</h2>
                    <nav class="mt-2 space-y-1">
                    <ul className="space-y-2">
        {menu.map((item) => (
          <li
            key={item.key}
            //className={`cursor-pointer ${currentPage === item.key ? "font-bold text-blue-600" : ""}`}
            onClick={() => onMenuSelect(item.key)}
          class="cursor-pointer flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
            {item.label}
          </li>
        ))}
      </ul>
      </nav>
   
                </div>
            </div>

            
            <div class="border-t mt-auto">
                <div class="p-4">
                    <div class="flex items-center">
                        <img src={myPic} alt="User avatar" class="h-8 w-8 rounded-full"></img>
                        <div class="ml-3">
                            <p class="text-sm font-medium text-gray-700">Rahul Charvekar</p>
                            <p class="text-xs text-gray-500">rcharvekar@gmail.com</p>
                        </div>
                        <button class="ml-auto text-gray-400 hover:text-gray-500">
                            <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        
        <div class="flex-1 bg-gray-50 flex">
            
        </div>
    </div>

}
    