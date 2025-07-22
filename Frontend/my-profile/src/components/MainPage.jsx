import About from "./About";
import Contact from "./Contact";
import Dashboard from "./Dashboard";

export default function MainPage({ currentPage }) {
  switch (currentPage) {
    case "contact":
      return <Contact />;
    case "dashboard":
      return <Dashboard />;
    case "about":
    default:
      return <About />;
  }
}