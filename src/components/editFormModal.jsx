import { useState } from "react";
import { MdClose } from "react-icons/md";
import { useGlobalContext } from "../utils/context";
import { SuccessModal } from "./modals/success";
import customFetch from "../utils/customFetch";

export const EditModal = ({
  routeTitle,
  closeEditModal,
  userData,
  id,
  seeChangesFunction,
}) => {
  const { firstName, lastName, email, phoneNumber, dob, address, role } =
    userData;

  const [formData, setFormData] = useState({
    firstName: firstName,
    lastName: lastName,
    email: email,
    phoneNumber: phoneNumber,
    dob: dob ? dob : "",
    address: address ? address : "",
    role: role,
  });

  const [editSuccess, setEditSuccess] = useState(false);

  const { setGlobalLoading } = useGlobalContext();

  const userFormFields = [
    {
      id: 0,
      name: "firstName",
      label: "First Name",
      type: "text",
      placeHolder: "Enter first name",
    },
    {
      id: 1,
      name: "lastName",
      label: "Last Name",
      type: "text",
      placeHolder: "Enter last name",
    },
    {
      id: 2,
      name: "email",
      label: "Email Address",
      type: "email",
      placeHolder: "Enter email address",
    },
    {
      id: 3,
      name: "phoneNumber",
      label: "Phone Number",
      type: "tel",
      placeHolder: "Enter phone number",
    },
    {
      id: 4,
      name: "dob",
      label: "Date of Birth",
      type: "date",
      placeHolder: "Enter date of birth",
    },
    {
      id: 5,
      name: "address",
      label: "Address",
      type: "text",
      placeHolder: "Enter address",
    },
    {
      id: 7,
      name: "role",
      label: "Role",
      type: "text",
      placeHolder: "Enter role (ADMIN | USER | RIDER)",
      options: ["ADMIN", "USER", "RIDER"],
    },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  async function handleSaveChanges(e) {
    e.preventDefault();
    setGlobalLoading(true);
    const url = `admin/users/${id}`;
    try {
      const { status } = await customFetch.patch(url, formData);

      if (status === 200) {
        setGlobalLoading(false);
        setEditSuccess(true);
        seeChangesFunction();
      }
    } catch (error) {
      setGlobalLoading(false);
    }
  }

  return (
    <article className=" modalBG">
      {editSuccess ? (
        <SuccessModal
          closeParentModal={closeEditModal}
          closeModalFunction={setEditSuccess}
          message={`${routeTitle} updated successfully`}
        />
      ) : (
        <div className=" longModalContainer border-4 px-4">
          {/* header */}
          <div className=" flex justify-between mb-4 ">
            <p className=" text-lg font-semibold text-gray900 ">
              <span className=" ">Edit {routeTitle}</span>
            </p>
            {/* cancel button */}
            <button onClick={() => closeEditModal(false)}>
              <MdClose size={24} className=" text-gray500" />
            </button>
          </div>
          <form
            onSubmit={handleSaveChanges}
            className=" flex flex-col gap-y-2 mt-6 pt-4 border-t  border-gray200 "
          >
            {userFormFields.map(
              ({ id, label, name, type, placeHolder, options }) => (
                <div key={id} className=" px-4">
                  <label className=" text-gray700 font-medium text-sm mb-1">
                    {label}*
                  </label>
                  {!options ? (
                    <input
                      type={type}
                      name={name}
                      value={formData[name]}
                      onChange={handleChange}
                      className={`border-gray300 text-gray900 inline-block w-full border rounded-lg py-2 pl-2 globalInputRingGreen`}
                      placeholder={placeHolder}
                    />
                  ) : (
                    <select
                      name="role"
                      value={formData[name]}
                      onChange={handleChange}
                      className="border-gray300 text-gray900 bg-white inline-block w-full border rounded-lg py-2 pl-2 globalInputRingGreen"
                    >
                      {options.map((option,index) => (
                        <option key={index} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )
            )}

            {/* submit button */}
            <div className=" px-4 border-t  border-gray200 mt-4 ">
              <button type="submit" className=" smallModalButton ">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </article>
  );
};
