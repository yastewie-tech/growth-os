# Design System Integration

This system implements the "Clean Aesthetic" + "Modern Editorial" visual language.

## Tailwind Configuration Tokens

We have extended `tailwind.config.js` with semantic tokens:

### Colors
- `bg-design-background` (Page background: #F9F9F9)
- `bg-design-lavender` (Accent: #E9D9F7)
- `bg-design-pink` (Accent: #FDE8F0) 
- `bg-design-blue` (Accent: #E6F4FF)
- `text-design-text` (Primary text: #111827)
- `text-design-text-muted` (Secondary text: #6B7280)

### Layout & Shape
- `rounded-3xl` (32px radius for large cards)
- `rounded-2xl` (24px radius for internal blocks)
- `shadow-soft` (0 10px 30px -5px rgba(0,0,0,0.05))

---

## Component Examples

### 1. Bento Grid Card (Main Feature)
Large card with image background, gradient overlay, and extreme rounding.

```tsx
<div className="group relative overflow-hidden rounded-3xl bg-white shadow-soft transition-all hover:shadow-lg h-[400px]">
  <img 
    src="/path/to/image.jpg" 
    alt="Feature" 
    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" 
  />
  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
  
  <div className="absolute bottom-0 p-8 w-full">
    <div className="mb-2 inline-flex items-center rounded-full bg-design-lavender px-3 py-1 text-xs font-medium text-design-text">
      Strategy
    </div>
    <h3 className="text-2xl font-bold tracking-tight text-white mb-2">
      Q3 Growth Hypothesis
    </h3>
    <div className="flex items-center text-white/80 text-sm">
      <span className="mr-2">View details</span>
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
         ↗ 
      </div>
    </div>
  </div>
</div>
```

### 2. Editorial Header
Minimal "Pill-shaped" header with large whitespace.

```tsx
<header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-100">
  <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
    <div className="flex items-center gap-2 font-bold text-xl tracking-tighter">
      GrowthOS
    </div>
    
    <nav className="hidden md:flex items-center gap-8">
      {['Experiments', 'Pipeline', 'Results', 'Library'].map((item) => (
        <a key={item} href="#" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">
          {item}
        </a>
      ))}
    </nav>
    
    <div className="flex items-center gap-3">
      <button className="h-10 w-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50">
        <span className="sr-only">Search</span>
        🔍
      </button>
      <div className="h-10 w-10 rounded-full bg-gray-100 overflow-hidden">
        <img src="https://github.com/shadcn.png" alt="User" />
      </div>
    </div>
  </div>
</header>
```

### 3. Glassmorphism Status Panel
Floating panel with blur effect.

```tsx
<div className="absolute top-6 right-6 backdrop-blur-md bg-white/40 border border-white/30 rounded-2xl p-4 shadow-sm">
  <div className="flex items-center gap-2">
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
    </span>
    <span className="text-xs font-bold uppercase tracking-wider text-design-text/80">
      Live Test
    </span>
  </div>
</div>
```

### 4. Typography Hierarchy (Glossier Style)

```tsx
<div className="space-y-6 max-w-2xl py-12">
  <h1 className="text-5xl font-bold tracking-tight text-design-text leading-[0.95]">
    Unlock higher <br/>
    <span className="text-gray-400">conversion rates.</span>
  </h1>
  
  <p className="text-lg text-design-text-muted leading-relaxed max-w-md">
    Data-driven experiments designed to validate your assumptions faster than ever before.
  </p>
  
  <button className="rounded-full bg-black px-8 py-4 text-white font-medium hover:bg-gray-800 transition-colors flex items-center gap-2">
    Start Experiment
    <span className="text-lg">→</span>
  </button>
</div>
```
