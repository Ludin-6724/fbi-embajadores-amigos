import { createBrowserClient } from '@supabase/ssr'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function test() {
  console.log('Testing Supabase query...')
  const { data, error } = await supabase.from('posts').select('id').limit(1)
  if (error) {
    console.error('FAIL:', error.message)
    process.exit(1)
  } else {
    console.log('SUCCESS: Found', data.length, 'posts')
    process.exit(0)
  }
}

test()
