import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Chat from './Chat'
import FileManager from './FileManager'
import TaskManager from './TaskManager'

function App() {
  return (
    <>
      <Chat/>
      <FileManager/>
      <TaskManager/>
    </>
  )
}

export default App
