import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Site } from './pages/Site';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/site" element={<Site />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
