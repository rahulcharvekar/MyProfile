import myPic from '../assets/mypic.jpg';

export default function About() {
  return ( 
    <>       
    <div class="bg-gray-100">
    <div class="container mx-auto py-8">
        <div class="grid grid-cols-4 sm:grid-cols-12 gap-6 px-4">
            <div class="col-span-4 sm:col-span-3">
                <div class="bg-white shadow rounded-lg p-6">
                    <div class="flex flex-col items-center">
                        <img src={myPic} alt="Profile" className="w-32 h-32 bg-gray-300 rounded-full mb-4 shrink-0">
                        </img>
                        <h1 class="text-xl font-bold">Rahul Charvekar</h1>
                        <p class="text-gray-700">Software Developer</p>
                        <div class="mt-6 flex flex-wrap gap-4 justify-center">
                            <a href="#" class="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded">Contact</a>
                            <a href="#" class="bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded">Resume</a>
                        </div>
                    </div>
                    <hr class="my-6 border-t border-gray-300"/>
                    <div class="flex flex-col">
                        <span class="text-gray-700 uppercase font-bold tracking-wider mb-2">Skills</span>
                        <ul>
                            <li class="mb-2">JavaScript</li>
                            <li class="mb-2">React</li>
                            <li class="mb-2">Node.js</li>
                            <li class="mb-2">HTML/CSS</li>
                            <li class="mb-2">Tailwind Css</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="col-span-4 sm:col-span-9">
                <div class="bg-white shadow rounded-lg p-6">
                    <h2 class="text-xl font-bold mb-4">Professional Summary</h2>
                    <p class="text-gray-700">Senior Technology Leader with 14+ years of experience in backend engineering, data platforms, and digital transformation for global banks. Expertise spans Java, Python, Oracle, Azure, and Databricks. Known for strong team collaboration, empathy toward peers, and a continuous drive to learn and explore new technologies. Recognized for innovation, mentoring, and driving high-impact modernization initiatives.
                    </p>

                    <h3 class="font-semibold text-center mt-3 -mb-2">
                        Find me on
                    </h3>
                    <div class="flex justify-center items-center gap-6 my-6">
                        <a class="text-gray-700 hover:text-orange-600" aria-label="Visit TrendyMinds LinkedIn" href="https://linkedin.com/in/rahulcharvekar"
                            target="_blank">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="h-6">
                                <path fill="currentColor"
                                    d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z">
                                </path>
                            </svg>
                        </a>                        
                        <a class="text-gray-700 hover:text-orange-600" aria-label="Visit TrendyMinds Instagram" href=""
                            target="_blank">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="h-6">
                                <path fill="currentColor"
                                    d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z">
                                </path>
                            </svg>
                        </a>                        
                    </div>


                    <h2 class="text-xl font-bold mt-6 mb-4">Experience</h2>
                    <div class="mb-6">
                        <div class="flex justify-between flex-wrap gap-2 w-full">
                            <span class="text-gray-700 font-bold">Associate Director / Sr. Developer & Data Engineer</span>
                            <p>
                                <span class="text-gray-700 mr-2">UBS Technology, Pune</span>
                                <span class="text-gray-700">Dec 2022 – Present </span>
                            </p>
                        </div>
                        <p class="mt-2">
                            UBS Desc
                        </p>
                    </div>                    
                    <div class="mb-6">
                        <div class="flex justify-between flex-wrap gap-2 w-full">
                            <span class="text-gray-700 font-bold">Sr. Consultant Specialist / Tech Lead </span>
                            <p>
                                <span class="text-gray-700 mr-2">HSBC Technology</span>
                                <span class="text-gray-700">Sep 2021 – Dec 2022 </span>
                            </p>
                        </div>
                        <p class="mt-2">
                            HSBC Desc
                        </p>
                    </div>
                    <div class="mb-6">
                        <div class="flex justify-between flex-wrap gap-2 w-full">
                            <span class="text-gray-700 font-bold">Manager / Data Platform Engineer </span>
                            <p>
                                <span class="text-gray-700 mr-2">Citicorp </span>
                                <span class="text-gray-700">Jun 2020 – Aug 2021 </span>
                            </p>
                        </div>
                        <p class="mt-2">
                            Citi Desc
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
                </>
  );
}