import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from 'motion/react';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { DriverApp } from './DriverApp';
import { LoginScreen } from './screens/LoginScreen';
import { SplashScreen } from './screens/SplashScreen';

export function App() {
  return (
    // LazyMotion + domAnimation: só o necessário do Motion vai para o bundle.
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <div className="mx-auto min-h-dvh w-full max-w-md overflow-x-clip bg-white md:shadow-[0_0_40px_rgb(46_47_113/0.12)]">
            <Root />
          </div>
        </AuthProvider>
      </MotionConfig>
    </LazyMotion>
  );
}

function Root() {
  const { state } = useAuth();
  const key = state.status === 'signedIn' ? `app-${state.driver.id}` : state.status;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div key={key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        {state.status === 'loading' && <SplashScreen />}
        {state.status === 'signedOut' && <LoginScreen notice={state.notice} />}
        {state.status === 'signedIn' && <DriverApp driver={state.driver} />}
      </m.div>
    </AnimatePresence>
  );
}
