import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xxtxrphinbpuftaguyfs.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4dHhycGhpbmJwdWZ0YWd1eWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0OTE4NDksImV4cCI6MjA1MzA2Nzg0OX0.VdggrX2tFl-oFSvusQG6tURNHu23yli9uP6NR390WBE'
export const supabase = createClient(supabaseUrl, supabaseKey)