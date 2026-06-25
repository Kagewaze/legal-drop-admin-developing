import React, { useEffect, useState } from "react";
import { useGlobalContext } from "../../utils/context";
import Upload from "../../assets/upload.svg";
import Autocomplete from "react-google-autocomplete";
import customFetch from "../../utils/customFetch";

export const ReceiverForm = () => {
  const {
    apiKey,
    senderForm,
    receiversForm,
    setReceiversForm,
    defaultFormData,
    setGlobalLoading,
  } = useGlobalContext();
  const [receiverCategories, setReceiverCategories] = useState([]);

  const medicalSupplyCategories = [
    "Regular",
    "Temp: Cooler",
    "Temp: Heat Pack",
    "Temp: Controlled",
  ];

  const groceryCategories = [
    "food",
    "clothes",
    "electronics",
    "books",
    "household",
    "personal care",
    "beverages",
    "snacks",
    "frozen foods",
    "baby products",
    "pets",
    "home goods",
    "stationery",
    "others",
  ];

  const legalDocumentCategories = [
    "Contracts",
    "Court Documents",
    "Certificates",
    "Legal Notices",
    "Wills and Testaments",
    "Deeds and Titles",
    "Patents and Trademarks",
    "Licenses and Permits",
    "Immigration Documents",
    "Legal Correspondence",
    "Regulatory Filings",
    "Affidavits and Sworn Statements",
    "Others",
  ];

  const receiverFormFields = [
    {
      id: 1,
      name: "receiverName",
      label: "Receiver Name",
      type: "text",
      placeHolder: "Receiver name",
      isRequired: true,
    },
    {
      id: 2,
      name: "receiverPhone",
      label: "Receiver Phone",
      type: "text",
      placeHolder: "Receiver phone",
      isRequired: true,
    },
    {
      id: 3,
      name: "receiverEmail",
      label: "Receiver Email",
      type: "email",
      placeHolder: "Receiver email",
      isRequired: false,
    },
    {
      id: 4,
      name: "receiverAltPhone",
      label: "Receiver AltPhone",
      type: "text",
      placeHolder: "Receiver alt phone",
      isRequired: false,
    },
    {
      id: 5,
      name: "receiverNote",
      label: "Receiver Note",
      type: "text",
      placeHolder: "Receiver note",
      isRequired: false,
    },
    {
      id: 6,
      name: "weight",
      label: "weight",
      type: "text",
      placeHolder: "Weight",
      isRequired: false,
    },
    {
      id: 7,
      name: "quantity",
      label: "quantity",
      type: "text",
      placeHolder: "Quantity",
      isRequired: false,
    },
    {
      id: 8,
      name: "value",
      label: "value",
      type: "text",
      placeHolder: "Item Value",
      isRequired: false,
    },
    {
      id: 9,
      name: "distance",
      label: "distance",
      type: "text",
      placeHolder: "Distance",
      isRequired: true,
    },
    {
      id: 10,
      name: "categories",
      label: "categories",
      type: "select",
      placeHolder: "Select Category",
      options: receiverCategories,
    },
    {
      id: 11,
      name: "fragility",
      label: "fragility",
      type: "text",
      placeHolder: "Fragility (1-10)",
      isRequired: false,
    },
  ];

  const handleReceiverChange = (index, e) => {
    const { name, type, value, checked } = e.target;
    const updatedReceivers = [...receiversForm];
    updatedReceivers[index][name] = type === "checkbox" ? checked : value;
    setReceiversForm(updatedReceivers);
  };

  const addReceiver = () => {
    setReceiversForm([...receiversForm, { ...defaultFormData.receiver }]);
  };

  const removeReceiver = (index) => {
    const updatedReceivers = receiversForm.filter((_, i) => i !== index);
    setReceiversForm(updatedReceivers);
  };

  async function handleImgUpload(e, index) {
    setGlobalLoading(true);
    const file = e.target.files[0];
    const url = "file/upload";
    const formData = new FormData();
    formData.append("file", file);

    if (file) {
      try {
        const {
          data: { data },
          status,
        } = await customFetch.post(url, formData);

        if (status === 201) {
          setGlobalLoading(false);
          const updatedReceivers = [...receiversForm];
          updatedReceivers[index].itemImages.push(data.url); // Add URL to the specific receiver's itemImages array
          setReceiversForm(updatedReceivers);
        }
      } catch (error) {
        setGlobalLoading(false);
        toast.error("Image upload failed");
      }
    }
  }

  // updates the receiver address and coordinates based on the selected place
  function handlePlaceSelected(place, index) {
    const updatedReceivers = [...receiversForm];
    updatedReceivers[index].receiverAddress = place.formatted_address;
    setReceiversForm(updatedReceivers);

    const location = place.geometry?.location;
    if (location) {
      updatedReceivers[index].receiverLocation.latitude = location.lat();
      updatedReceivers[index].receiverLocation.longitude = location.lng();
      setReceiversForm(updatedReceivers);
    }
  }

  // Update receiver categories based on the selected sender type
  useEffect(() => {
    let categories = [];
    if (senderForm.section === "medical_supply") {
      categories = medicalSupplyCategories;
    } else if (senderForm.section === "grocery") {
      categories = groceryCategories;
    } else if (senderForm.section === "legal_document") {
      categories = legalDocumentCategories;
    } else {
      categories = [];
    }

    setReceiverCategories(categories);
  }, [senderForm.section]);

  return (
    <div className="  mt-8">
      <h2 className="text-lg font-medium text-primaryGreen  ">
        Receiver Details
      </h2>
      {/* google autocomplete */}

      {receiversForm.map((receiver, index) => (
        <div key={index} className="mb-4 pl-2 pt-2 py-4 border-b">
          <div>
            <span className=" text-gray-900 font-medium text-sm mb-1">
              Receiver Address
            </span>
            <Autocomplete
              onPlaceSelected={(place) => handlePlaceSelected(place, index)}
              apiKey={apiKey}
              options={{
                types: ["geocode"],
                componentRestrictions: { country: "ca" },
              }}
              className="google-address-input border-gray300 bg-transparent text-gray900 inline-block w-full border rounded-lg shadow-sm py-1 pl-2 globalInputRingGreen mb-4"
            />
          </div>
          <h3 className="text-md font-medium text-gray-700 mb-2">
            Receiver {index + 1}
          </h3>
          <div className="flex gap-4 flex-col">
            {receiverFormFields.map(
              ({ name, type, id, placeHolder, options, isRequired, label }) => (
                <div key={id}>
                  <label className="text-gray-900 font-medium text-sm mb-1">
                    {label}
                    {!isRequired && (
                      <span className=" text-xs text-gray500">(optional)</span>
                    )}
                  </label>
                  {type !== "select" ? (
                    <input
                      type={type}
                      name={name}
                      value={receiver[name]}
                      onChange={(e) => handleReceiverChange(index, e)}
                      className={`border-gray300 bg-transparent text-gray900 inline-block w-full border rounded-lg shadow-sm py-1 pl-2 globalInputRingGreen`}
                      placeholder={placeHolder}
                      required={isRequired}
                    />
                  ) : (
                    <select
                      name={name}
                      value={receiver[name] || ""}
                      onChange={(e) => handleReceiverChange(index, e)}
                      className="border-gray300 bg-transparent shadow-sm  inline-block w-full border rounded-lg py-1 pl-2 globalInputRingGreen"
                      required
                    >
                      <option value="">{placeHolder}</option>
                      {options?.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )
            )}
            {/* Top Priority Checkbox */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="topPriority"
                  checked={receiver.topPriority}
                  onChange={(e) => handleReceiverChange(index, e)}
                  className="mr-2"
                />
                Top Priority
              </label>
            </div>
          </div>

          {/* Image Upload for Receiver */}
          <div className="mb-4 pl-4 pt-2 rounded-lg">
            <h3 className="text-md font-medium text-gray-700 mb-2">
              Receiver {index + 1}
            </h3>

            {/* Image Upload Section */}
            <div className="mt-4">
              <label className="block text-gray500 font-medium text-sm mb-1">
                Upload Item Image for Receiver {index + 1}
              </label>
              <div className="flex items-center gap-3">
                <label
                  htmlFor={`file-input-${index}`}
                  className="flex flex-col items-center justify-center w-24 h-24 border border-gray-300 rounded-lg cursor-pointer"
                >
                  <img src={Upload} alt="Upload Icon" className="w-8 h-8" />
                  <span className="text-sm text-gray-500">Upload</span>
                </label>
                <input
                  type="file"
                  id={`file-input-${index}`}
                  accept="image/*"
                  onChange={(e) => handleImgUpload(e, index)}
                  className="hidden"
                />

                {/* Small Image Preview */}
                {receiver.itemImages.length > 0 && (
                  <img
                    src={receiver.itemImages[receiver.itemImages.length - 1]} // Show the last uploaded image
                    alt="Uploaded Preview"
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Conditionally render the Remove Receiver button */}
          {receiversForm.length > 1 && (
            <button
              type="button"
              onClick={() => removeReceiver(index)}
              className=" p-2 rounded-md text-xs  border shadow-md border-primaryGreen hover:text-primary600 globalTransition"
            >
              Remove Receiver {index + 1}
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addReceiver}
        className=" mt-4 p-2 rounded-md text-xs  border shadow-md border-primaryGreen hover:text-primary600 globalTransition"
      >
        Add Another Receiver
      </button>
    </div>
  );
};
