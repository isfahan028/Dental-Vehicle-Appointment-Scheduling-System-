import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import * as api from './lib/api';

function App() {
  useEffect(() => {
    const initData = async () => {
      try {
        await api.initializeSampleData();
        console.log('Sample data initialized');
      } catch (error) {
        console.log('Data initialization skipped (may already exist):', error);
      }
    };

    initData();
  }, []);

  return <RouterProvider router={router} />;
}

export default App;