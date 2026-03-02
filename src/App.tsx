import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { dAppKit } from './dapp-kit';
import { Home } from './pages/Home';
import { Mvr } from './pages/Mvr';
import { NotFound } from './pages/NotFound';
import { Sign } from './pages/Sign';
import { Site } from './pages/Site';

function App() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/site/*" element={<Site />} />
          <Route path="/mvr/*" element={<Mvr />} />
          <Route path="/sign" element={<Sign />} />
          <Route path="/404.html" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DAppKitProvider>
  );
}

export default App;
