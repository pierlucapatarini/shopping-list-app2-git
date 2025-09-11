import { createClient } from '@supabase/supabase-js'

// Usa le variabili d'ambiente. Il prefisso REACT_APP_ è necessario per le app client.
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)