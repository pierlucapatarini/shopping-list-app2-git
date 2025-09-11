import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gvcdchndpofcfdvhpyos.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2Y2RjaG5kcG9mY2ZkdmhweW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MDA2MzUsImV4cCI6MjA3MjM3NjYzNX0.KiAB8mRE6EvGTS6SC7cDAOW97co7wgQZeU3D7BGFugs'

console.log("URL:", process.env.REACT_APP_SUPABASE_URL);
console.log("KEY:", process.env.REACT_APP_SUPABASE_ANON_KEY);


export const supabase = createClient(supabaseUrl, supabaseAnonKey);
