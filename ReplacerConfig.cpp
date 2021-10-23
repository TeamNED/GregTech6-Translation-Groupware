#include "ReplacerConfig.hpp"

ReplacerConfig::ReplacerConfig(int argc, char const *argv[]) {
  // declare options
  po::options_description desc("Available options");
  desc.add_options()                                                     //
      ("workplace,w", po::value<string>(),                               //
       "workplace for language files and configs")                       //
      ("language,l", po::value<string>(), "language code")               //
      ("source,s", po::value<vector<string>>(), "source language files") //
      ("target,t", po::value<vector<string>>(),                          //
       "target language files")                                          //
      ("config,c", po::value<string>(), "config file");                  //

  // parse and store options
  po::variables_map vm;
  po::store(po::parse_command_line(argc, argv, desc), vm);
  po::notify(vm);

  // process options
  // --language lang
  if (vm.count("language")) {
    this->_lang = vm["language"].as<string>();
  } else {
    this->_lang = "zh";
  }

  // --workplace workdir
  if (vm.count("workplace")) {
    fs::path workplace(vm["workplace"].as<string>());
    this->_config_path = workplace / "config.yml";
    this->_main_source_path = workplace / "en" / "GregTech.lang";
    this->_main_target_path = workplace / this->_lang / "GregTech.lang";
    this->_extra_source_path = workplace / "en" / "GregTech.extra.lang";
    this->_extra_target_path = workplace / this->_lang / "GregTech.extra.lang";
  }

  // --config config
  if (vm.count("config")) {
    this->_config_path = vm["config"].as<string>();
  }

  // --source main extra
  if (vm.count("source")) {
    auto source_paths = vm["source"].as<vector<string>>();
    if (source_paths.size() >= 1) {
      this->_main_source_path = fs::path(source_paths[0]);
      if (source_paths.size() >= 2) {
        this->_extra_source_path = fs::path(source_paths[1]);
      }
    }
  }

  // --target main extra
  if (vm.count("target")) {
    auto target_paths = vm["target"].as<vector<string>>();
    if (target_paths.size() >= 1) {
      this->_main_target_path = fs::path(target_paths[0]);
      if (target_paths.size() >= 2) {
        this->_extra_target_path = fs::path(target_paths[1]);
      }
    }
  }

  // Config guard
  if (this->_config_path.empty()) {
    throw std::invalid_argument("config file not exist");
  }

  string config_contents = _get_file_contents(this->_config_path.string());
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