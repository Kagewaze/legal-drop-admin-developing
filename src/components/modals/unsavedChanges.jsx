import saveIcon from "../../assets/corporateUser/save.svg";

export const UnsavedChangesModal = ({ cancelFunction, continueFunction }) => {
  return (
    <div className=" smallModalContainer">
      <div className="globalIconBG mb-4">
        <img src={saveIcon} alt="save" />
      </div>
      <h2 className="modalHeader">Unsaved changes</h2>
      <p className=" text-gray600 text-sm">
        Do you want to save or discard changes? <br /> <br /> Click{" "}
        <span className=" font-medium text-primary600">"Confirm"</span> to save
        changes or click{" "}
        <span className=" font-medium text-gray800">"Cancel"</span> to discard
        changes and go back.
      </p>
      <div className=" flex gap-x-3">
        <button
          onClick={cancelFunction}
          className=" border border-gray300 shadow-md rounded-md w-full text-gray700 font-semibold py-2 mt-8 text-center bg-white"
        >
          Cancel
        </button>
        <button onClick={continueFunction} className=" smallModalButton">
          Continue
        </button>
      </div>
    </div>
  );
};
