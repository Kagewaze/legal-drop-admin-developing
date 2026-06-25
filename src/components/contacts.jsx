import { useEffect, useState } from "react";
import customFetch from "../utils/customFetch";
import ReactPaginate from "react-paginate";
import { useGlobalContext } from "../utils/context";

export const Contacts = () => {
  const [contactDetails, setContactDetails] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { setGlobalLoading } = useGlobalContext();

  async function fetchContact(page = 1, limit = 10) {
    setGlobalLoading(true);
    const url = `contact-form?page=${page}&limit=${limit}`;

    try {
      const {
        data: { data, meta },
        status,
      } = await customFetch(url);

      if (status === 200) {
        setGlobalLoading(false);
        setContactDetails(data);
        setPageCount(meta.pageCount);
      }
    } catch (error) {
      setGlobalLoading(false);
      console.error("Error fetching contact details", error);
    }
  }

  const handleView = (contact) => {
    setSelectedContact(contact); // Set the selected contact
    setIsModalOpen(true); // Open the modal
  };

  const handleCloseModal = () => {
    setIsModalOpen(false); // Close the modal
    setSelectedContact(null); // Clear selected contact
  };

  // Handle page click
  function handlePageClick(event) {
    const newPage = event.selected + 1;
    setCurrentPage(newPage);
  }

  useEffect(() => {
    fetchContact(currentPage);
  }, [currentPage]);

  return (
    <section className="px-4">
      <h2 className="md:text-xl font-semibold mb-4">Contact Us</h2>
      <div className="overflow-auto">
        <table className="w-full table-auto border-collapse border text-center text-xs md:text-sm border-gray200 text-gray600">
          <thead>
            <tr className="bg-gray50 font-medium">
              <th className="border border-gray200 p-3">Email</th>
              <th className="border border-gray200 p-3">First Name</th>
              <th className="border border-gray200 p-3">Last Name</th>
              <th className="border border-gray200 p-3">Phone Number</th>
              <th className="border border-gray200 p-3">Message</th>
              <th className="border border-gray200 p-3">Action</th>
            </tr>
          </thead>
          {contactDetails.length < 1 ? (
            <tbody>
              <tr>
                <td colSpan="6" className="p-2 w-full">
                  No available contact yet
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {contactDetails.map((contact) => (
                <tr
                  key={contact.id}
                  className="globalTransition hover:bg-gray100 bg-white"
                >
                  <td className="p-2">{contact.email}</td>
                  <td className="p-2">{contact.firstName}</td>
                  <td className="p-2">{contact.lastName}</td>
                  <td className="p-2">{contact.phoneNumber}</td>
                  <td className="p-2">{contact.message.slice(0, 10)}...</td>
                  <td className="p-2">
                    <button
                      onClick={() => handleView(contact)}
                      className="px-3 py-1 mr-2 border p-1 rounded-md hover:bg-blue-100 globalTransition text-xs"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
        {/* Pagination */}
        <ReactPaginate
          breakLabel="..."
          nextLabel="next >"
          onPageChange={handlePageClick}
          pageRangeDisplayed={5}
          pageCount={pageCount}
          previousLabel="< previous"
          renderOnZeroPageCount={null}
          containerClassName="pagination"
          pageLinkClassName="page-num"
          previousLinkClassName="page-num"
          nextLinkClassName="page-num"
          activeLinkClassName="active"
        />
      </div>
      {/* Modal */}
      {isModalOpen && selectedContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-md w-3/4 md:w-1/2">
            <h3 className="text-lg font-semibold mb-4">Contact Details</h3>
            <p>
              <strong>Email:</strong> {selectedContact.email}
            </p>
            <p>
              <strong>First Name:</strong> {selectedContact.firstName}
            </p>
            <p>
              <strong>Last Name:</strong> {selectedContact.lastName}
            </p>
            <p>
              <strong>Phone Number:</strong> {selectedContact.phoneNumber}
            </p>
            <p>
              <strong>Message:</strong> {selectedContact.message}
            </p>
            <button
              onClick={handleCloseModal}
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
