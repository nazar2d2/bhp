import { CopyIcon } from "./assets/CopyIcon";
import { DiamondIcon } from "./assets/DiamondIcon";
import { HareIcon } from "./assets/HareIcon";

export const ContractInteraction = () => {
  // const [visible, setVisible] = useState(true);
  // const [newGreeting, setNewGreeting] = useState("");
  //
  // const { writeAsync, isLoading } = useScaffoldContractWrite({
  //   contractName: "YourContract",
  //   functionName: "setGreeting",
  //   args: [newGreeting],
  //   value: "0.01",
  //   onBlockConfirmation: txnReceipt => {
  //     console.log("📦 Transaction blockHash", txnReceipt.blockHash);
  //   },
  // });

  return (
    <div className="flex bg-base-300 relative pb-10">
      <DiamondIcon className="absolute top-24" />
      <CopyIcon className="absolute bottom-0 left-36" />
      <HareIcon className="absolute right-0 bottom-24" />
      <div className="flex flex-col w-full mx-5 sm:mx-8 2xl:mx-20">
        <div>... content ...</div>
      </div>
    </div>
  );
};
