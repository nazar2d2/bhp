export const ContractData = () => {
  // const { address } = useAccount();
  // const [transitionEnabled, setTransitionEnabled] = useState(true);
  // const [isRightDirection, setIsRightDirection] = useState(false);
  // const [marqueeSpeed, setMarqueeSpeed] = useState(0);
  //
  // const containerRef = useRef<HTMLDivElement>(null);
  // const greetingRef = useRef<HTMLDivElement>(null);
  //
  // const { data: totalCounter } = useScaffoldContractRead({
  //   contractName: "YourContract",
  //   functionName: "totalCounter",
  // });
  //
  // const { data: currentGreeting, isLoading: isGreetingLoading } = useScaffoldContractRead({
  //   contractName: "YourContract",
  //   functionName: "greeting",
  // });
  //
  // useScaffoldEventSubscriber({
  //   contractName: "YourContract",
  //   eventName: "GreetingChange",
  //   listener: logs => {
  //     logs.map(log => {
  //       const { greetingSetter, value, premium, newGreeting } = log.args;
  //       console.log("📡 GreetingChange event", greetingSetter, value, premium, newGreeting);
  //     });
  //   },
  // });
  //
  // const {
  //   data: myGreetingChangeEvents,
  //   isLoading: isLoadingEvents,
  //   error: errorReadingEvents,
  // } = useScaffoldEventHistory({
  //   contractName: "YourContract",
  //   eventName: "GreetingChange",
  //   fromBlock: process.env.NEXT_PUBLIC_DEPLOY_BLOCK ? BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK) : 0n,
  //   filters: { greetingSetter: address },
  //   blockData: true,
  // });
  //
  // console.log("Events:", isLoadingEvents, errorReadingEvents, myGreetingChangeEvents);
  //
  // const { data: yourContract } = useScaffoldContract({ contractName: "YourContract" });
  // console.log("yourContract: ", yourContract);
  //
  // const { showAnimation } = useAnimationConfig(totalCounter);
  //
  // const showTransition = transitionEnabled && !!currentGreeting && !isGreetingLoading;
  //
  // useEffect(() => {
  //   if (transitionEnabled && containerRef.current && greetingRef.current) {
  //     setMarqueeSpeed(
  //       Math.max(greetingRef.current.clientWidth, containerRef.current.clientWidth) / MARQUEE_PERIOD_IN_SEC,
  //     );
  //   }
  // }, [transitionEnabled, containerRef, greetingRef]);

  return (
    <div className="flex flex-col justify-center items-center bg-[url('/assets/gradient-bg.png')] bg-[length:100%_100%] py-10 px-5 sm:px-0 lg:py-auto max-w-[100vw]">
      <div className={`flex flex-col max-w-md bg-base-200 bg-opacity-70 rounded-2xl shadow-lg px-5 py-4 w-full`}>
        ... content ...
      </div>
    </div>
  );
};
