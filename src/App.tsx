import { reatomComponent } from '@reatom/react'
import { appLifecycle, timer } from './model.ts'
import styles from './App.module.css'
import { SessionScreen } from './components/SessionScreen.tsx'
import { SetupScreen } from './components/SetupScreen.tsx'

export const App = reatomComponent(() => {
  appLifecycle()
  const status = timer().status

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>Simple HIIT Timer</h1>
      </header>
      {status === 'idle' ? <SetupScreen /> : <SessionScreen />}
    </main>
  )
}, 'App')
