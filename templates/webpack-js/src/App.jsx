import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app-container">
      <h1>React Forge App</h1>
      <p>Built with Vite & React</p>
      <button onClick={() => setCount((c) => c + 1)}>
        Count is {count}
      </button>
    </div>
  );
}

export default App;
