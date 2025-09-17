import { useState } from 'react'
import { Button } from '@/components/ui/button'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-8">
          <h1 className="text-4xl font-bold tracking-tight">
            Web Tailored Fitness
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your personalized fitness journey starts here. Built with Vite, React, TypeScript, and shadcn/ui.
          </p>
          <div className="space-y-4">
            <Button 
              onClick={() => setCount((count) => count + 1)}
              size="lg"
            >
              Count is {count}
            </Button>
            <p className="text-sm text-muted-foreground">
              Click the button to test the setup!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
