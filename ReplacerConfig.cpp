#include "ReplacerConfig.hpp"

ReplacerConfig::ReplacerConfig() {}

ReplacerConfig::ReplacerConfig(int argc, char const *argv[]) {
  // Declare options
  po::options_description desc("Available options");
  desc.add_options()                                                     //
      ("workplace,w", po::value<string>(),                               //
       "workplace for language files and configs")                       //
      ("language,l", po::value<string>(), "language code")               //
      ("source,s", po::value<vector<string>>(), "source language files") //
      ("target,t", po::value<vector<string>>(),                          //
       "target language files")                                          //
      ("config,c", po::value<string>(), "config file");                  //

  po::variables_map vm;
  po::store(po::parse_command_line(argc, argv, desc), vm);
  po::notify(vm);

  if (vm.count("config")) {
    this->_config_path = vm["config"].as<string>();
  } else {
    throw std::invalid_argument("config file not exist");
  }

  string config_contents = _get_file_contents(this->_config_path);
  ryml::Tree tree = ryml::parse(ryml::to_csubstr(config_contents));
  ryml::NodeRef root = tree.rootref();
  for (ryml::NodeRef const &child : root.children()) {
    std::cout << "key: " << child.key() << std::endl;
  }
}

string ReplacerConfig::_get_file_contents(const string &filename) {
  std::ifstream in(filename, std::ios::in | std::ios::binary);
  if (!in) {
    throw std::invalid_argument("config file " + filename + " doesn't exist");
  }
  std::ostringstream contents;
  contents << in.rdbuf();
  return contents.str();
}

ReplacerConfig::~ReplacerConfig() {}