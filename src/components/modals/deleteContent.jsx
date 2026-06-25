import trashRedIcon from "../../assets/corporateUser/trashRed.svg";

export const DeleteModal = ({ title, cancelFunction, deleteFunction }) => {
  return (
    <article className=" modalBG">
      <div className=" smallModalContainer">
        <div className="globalIconBG mb-4">
          <img src={trashRedIcon} alt="save" />
        </div>
        {/* header */}
        <h2 className="modalHeader capitalize">
          Delete {title}{" "}
          {title.includes("customer") || title.includes("corporate")
            ? "User"
            : null}
        </h2>

        {/* message */}
        <p className=" text-gray600 text-sm">
          Are you sure you want to delete {title}
          <br /> <br /> Click{" "}
          <span className=" font-medium text-primary600">"Delete"</span> to
          remove permanently or click{" "}
          <span className=" font-medium text-gray800">"Cancel"</span> to go
          back.
        </p>

        <div className=" flex gap-x-3">
          <button
            onClick={cancelFunction}
            className=" border border-gray300 shadow-md rounded-md w-full text-gray700 font-semibold py-2 mt-8 text-center bg-white"
          >
            Cancel
          </button>
          <button
            onClick={deleteFunction}
            className="shadow-md rounded-md w-full text-white font-semibold py-2 mt-8 text-center bg-errorColor"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
};
