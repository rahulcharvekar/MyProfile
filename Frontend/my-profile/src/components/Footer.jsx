export default function Footer() {
  return (
    <footer>
    <div class="bg-indigo-700 py-4 text-gray-100">
      <div class="container mx-auto px-4">
        <div class="-mx-4 flex flex-wrap justify-between">
          <div class="px-4 w-full text-center sm:w-auto sm:text-left">
            Copyright © 2020
            <script>new Date().getFullYear() {">"} 2020 && document.write("- " + new Date().getFullYear())</script>- 2022
            Tailwindow. All Rights Reserved.
          </div>
        </div>
      </div>
    </div>
  </footer>
  );
}