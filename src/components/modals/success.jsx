import { FaRegCircleCheck } from "react-icons/fa6";
import { Link, useNavigate } from "react-router-dom";

export const SuccessModal = ({ closeModalFunction, message,closeParentModal }) => {
  const navigate = useNavigate();

  function handleContinue() {

    if(closeParentModal){
      closeParentModal(false)
    }

    closeModalFunction(false);
  }

  return (
    <div className=" smallModalContainer">
      <div className="globalIconBG text-primary600 mb-4">
        <FaRegCircleCheck size={24} />
      </div>
      <h2 className="modalHeader">Successful</h2>
      {/* <p>Driver assigned successfully. Click continue</p> */}
      <p className=" capitalize">{message}</p>
      <button onClick={handleContinue} className=" smallModalButton">
        Continue
      </button>
    </div>
  );
};
