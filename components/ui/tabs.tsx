'use client'

import * as React from "react"

const TabsContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
}>({ value: '', onValueChange: () => {} })

export function Tabs({ 
  defaultValue, 
  value, 
  onValueChange, 
  children, 
  className 
}: { 
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}) {
  const [internalValue, setInternalValue] = React.useState(value || defaultValue || '')

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (!value) {
        setInternalValue(newValue)
      }
      onValueChange?.(newValue)
    },
    [value, onValueChange]
  )

  const currentValue = value || internalValue

  return (
    <TabsContext.Provider value={{ value: currentValue, onValueChange: handleValueChange }}>
      <div className={className} data-state={currentValue}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={`flex items-center justify-center ${className || ''}`}>{children}</div>
}

export function TabsTrigger({ 
  value, 
  children, 
  className 
}: { 
  value: string
  children: React.ReactNode
  className?: string 
}) {
  const context = React.useContext(TabsContext)
  const isSelected = context.value === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      data-state={isSelected ? "active" : "inactive"}
      onClick={() => context.onValueChange(value)}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:shadow-sm text-gray-600 data-[state=active]:text-primary-700 ${className || ''}`}
    >
      {children}
    </button>
  )
}

export function TabsContent({ 
  value, 
  children, 
  className 
}: { 
  value: string
  children: React.ReactNode
  className?: string 
}) {
  const context = React.useContext(TabsContext)
  const isSelected = context.value === value

  if (!isSelected) return null

  return (
    <div
      role="tabpanel"
      data-state={isSelected ? "active" : "inactive"}
      className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className || ''}`}
    >
      {children}
    </div>
  )
}
