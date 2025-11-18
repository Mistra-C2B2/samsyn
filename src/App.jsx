import { useState } from 'react'
import Map from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/clerk-react'

function App() {
  const [viewState, setViewState] = useState({
    longitude: -100,
    latitude: 40,
    zoom: 3.5
  })

  return (
    <div className="App">
      <header style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1,
        padding: '1rem',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '1rem',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <SignedOut>
          <SignInButton mode="modal" />
          <SignUpButton mode="modal" />
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle="https://demotiles.maplibre.org/style.json"
      />
    </div>
  )
}

export default App
