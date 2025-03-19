"use client";

import { createContext } from 'react';
import { AuthContextValue } from './AuthTypes';

// Create the context with null as initial value
const AuthContext = createContext<AuthContextValue | null>(null);

export default AuthContext;
