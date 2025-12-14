import ConsentGate from "./tbw/core/ConsentGate";

import Header from "./tbw/layout/Header";
import Hero from "./tbw/layout/Hero";
import AISearch from "./tbw/search/AISearch";
import StatusPanel from "./tbw/status/StatusPanel";

import "./App.css";

export default function App() {
  return (
    <ConsentGate>
      <Header />
      <main>
        <Hero />
        <AISearch />
        <StatusPanel />
      </main>
    </ConsentGate>
  );
}
