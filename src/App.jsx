import React from 'react';
import { AuthProvider } from './context/AuthContext';
import Experience from './experience/App';
import './experience/styles.css';
import './experience/extra.css';
import './experience/integration.css';
export default function App() { return <AuthProvider><Experience /></AuthProvider>; }
